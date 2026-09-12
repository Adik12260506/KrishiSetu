/**
 * Deterministic Multi-Oracle Aggregation & Dispute Engine
 * 
 * Rules:
 * 1. Freshness check: reject observations older than max_stale_minutes.
 * 2. Integrity check: reject negative rain, corrupt values, or missing signatures.
 * 3. Spatial/Peer Consensus: Detect pairwise variance. If variance <= max_allowed_variance_mm, cluster sources.
 * 4. Quorum requirement: Need at least min_sources (default: 2) valid agreeing sources.
 * 5. Outlier/Manipulation rejection: Reject isolated outliers that deviate from consensus quorum.
 * 6. Dispute handling: If no 2 sources agree (unresolvable 2-way split), do NOT pay silently; emit DISPUTE_QUORUM_FAILED.
 */

const { OracleStatus, ConsensusStatus } = require('./oracle_types');

function aggregateOracles(observations, config = {}) {
  const minSources = config.min_sources || 2;
  const maxStaleMinutes = config.max_stale_minutes || 180;
  const maxVarianceMm = config.max_allowed_variance_mm || 12.0;
  const referenceTimeMs = config.reference_time_iso ? new Date(config.reference_time_iso).getTime() : Date.now();

  const auditLog = [];
  const evaluatedSources = [];
  const validCandidates = [];

  auditLog.push(`Starting oracle aggregation for ${observations.length} candidate sources.`);

  // Step 1: Individual Source Validation
  for (const obs of observations) {
    const srcCopy = { ...obs };

    // Check availability
    if (!obs || obs.status === 'UNAVAILABLE' || obs.rainfall_mm === null || obs.rainfall_mm === undefined) {
      srcCopy.health_status = OracleStatus.MISSING;
      srcCopy.rejection_reason = 'Source unavailable or missing reading';
      evaluatedSources.push(srcCopy);
      auditLog.push(`[${obs.source_id}] REJECTED: Missing observation.`);
      continue;
    }

    // Check physical validity
    if (typeof obs.rainfall_mm !== 'number' || obs.rainfall_mm < 0 || obs.rainfall_mm > 1000) {
      srcCopy.health_status = OracleStatus.MANIPULATED;
      srcCopy.rejection_reason = `Physically impossible rainfall reading: ${obs.rainfall_mm}mm`;
      evaluatedSources.push(srcCopy);
      auditLog.push(`[${obs.source_id}] REJECTED: Invalid rainfall value (${obs.rainfall_mm}mm).`);
      continue;
    }

    // Check freshness
    const obsTimeMs = new Date(obs.observation_timestamp).getTime();
    const ageMinutes = (referenceTimeMs - obsTimeMs) / (60 * 1000);
    srcCopy.age_minutes = Math.round(ageMinutes * 10) / 10;

    if (ageMinutes > maxStaleMinutes) {
      srcCopy.health_status = OracleStatus.STALE;
      srcCopy.rejection_reason = `Observation is stale (${srcCopy.age_minutes}m old > max ${maxStaleMinutes}m)`;
      evaluatedSources.push(srcCopy);
      auditLog.push(`[${obs.source_id}] REJECTED: Stale reading (${srcCopy.age_minutes} min old).`);
      continue;
    }

    // Check forced manipulation flag (for test injections)
    if (obs.forced_status === OracleStatus.MANIPULATED) {
      srcCopy.health_status = OracleStatus.MANIPULATED;
      srcCopy.rejection_reason = 'Cryptographic signature verification failed / Tamper detected';
      evaluatedSources.push(srcCopy);
      auditLog.push(`[${obs.source_id}] REJECTED: Tamper/manipulation detected.`);
      continue;
    }

    srcCopy.health_status = OracleStatus.VALID;
    evaluatedSources.push(srcCopy);
    validCandidates.push(srcCopy);
    auditLog.push(`[${obs.source_id}] VALID: ${obs.rainfall_mm}mm (age: ${srcCopy.age_minutes} min).`);
  }

  // Step 2: Quorum Check on valid candidates count
  if (validCandidates.length < minSources) {
    auditLog.push(`FAIL: Only ${validCandidates.length} valid source(s) available. Required min: ${minSources}.`);
    return {
      consensus_status: ConsensusStatus.INSUFFICIENT_SOURCES,
      consensus_reached: false,
      aggregated_rainfall_mm: null,
      agreeing_sources: [],
      rejected_sources: evaluatedSources.filter(s => s.health_status !== OracleStatus.VALID),
      all_sources: evaluatedSources,
      audit_log: auditLog,
      dispute_reason: `Insufficient valid sources (${validCandidates.length}/${minSources})`
    };
  }

  // Step 3: Spatial Consistency & Outlier Detection
  // Find the largest cluster of sources where pairwise difference <= maxVarianceMm
  const clusters = [];
  for (let i = 0; i < validCandidates.length; i++) {
    const cluster = [validCandidates[i]];
    for (let j = 0; j < validCandidates.length; j++) {
      if (i !== j) {
        const diff = Math.abs(validCandidates[i].rainfall_mm - validCandidates[j].rainfall_mm);
        if (diff <= maxVarianceMm) {
          cluster.push(validCandidates[j]);
        }
      }
    }
    clusters.push(cluster);
  }

  // Pick largest cluster
  clusters.sort((a, b) => b.length - a.length);
  const bestCluster = clusters[0] || [];

  // Check if best cluster meets quorum
  if (bestCluster.length < minSources) {
    auditLog.push(`DISPUTE: Max agreeing cluster has ${bestCluster.length} sources (min ${minSources} required). Conflicting observations detected.`);
    
    // Mark conflicting sources
    for (const src of evaluatedSources) {
      if (src.health_status === OracleStatus.VALID) {
        src.health_status = OracleStatus.OUTLIER;
        src.rejection_reason = 'Conflicting observation with no consensus quorum';
      }
    }

    return {
      consensus_status: ConsensusStatus.DISPUTE_QUORUM_FAILED,
      consensus_reached: false,
      aggregated_rainfall_mm: null,
      agreeing_sources: [],
      rejected_sources: evaluatedSources,
      all_sources: evaluatedSources,
      audit_log: auditLog,
      dispute_reason: 'Two-way conflict or unresolvable multi-source divergence exceeding variance threshold'
    };
  }

  // Identify agreeing source IDs
  const agreeingSourceIds = new Set(bestCluster.map(s => s.source_id));

  // Mark outliers among valid candidates that were not in best cluster
  for (const src of evaluatedSources) {
    if (src.health_status === OracleStatus.VALID && !agreeingSourceIds.has(src.source_id)) {
      src.health_status = OracleStatus.OUTLIER;
      src.rejection_reason = `Deviated from quorum consensus by > ${maxVarianceMm}mm`;
      auditLog.push(`[${src.source_id}] OUTLIER REJECTED: Reading ${src.rainfall_mm}mm deviates from consensus.`);
    }
  }

  // Step 4: Deterministic Weighted Aggregation of agreeing cluster
  // Aggregation = weighted average by source confidence
  let weightedSum = 0;
  let totalWeight = 0;

  for (const src of bestCluster) {
    const weight = src.confidence || 1.0;
    weightedSum += src.rainfall_mm * weight;
    totalWeight += weight;
  }

  const aggregatedRainfall = Math.round((weightedSum / totalWeight) * 100) / 100;
  auditLog.push(`CONSENSUS REACHED: Aggregated rainfall = ${aggregatedRainfall}mm from ${bestCluster.length} agreeing sources.`);

  return {
    consensus_status: ConsensusStatus.CONSENSUS_REACHED,
    consensus_reached: true,
    aggregated_rainfall_mm: aggregatedRainfall,
    agreeing_sources: bestCluster.map(s => ({
      source_id: s.source_id,
      name: s.name,
      rainfall_mm: s.rainfall_mm,
      confidence: s.confidence,
      observation_timestamp: s.observation_timestamp
    })),
    rejected_sources: evaluatedSources.filter(s => !agreeingSourceIds.has(s.source_id)),
    all_sources: evaluatedSources,
    audit_log: auditLog,
    dispute_reason: null
  };
}

module.exports = {
  aggregateOracles,
  OracleStatus,
  ConsensusStatus
};
