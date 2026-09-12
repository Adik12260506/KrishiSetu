/**
 * Explicit Oracle Data Types and Formal Status Taxonomy
 * FS-2604 Hardening Pass: Clean separation of distinct error states.
 */

const OracleStatus = {
  HEALTHY: 'HEALTHY',
  VALID: 'VALID',
  STALE: 'STALE',
  UNAVAILABLE: 'UNAVAILABLE',
  MISSING: 'MISSING',
  OUTLIER: 'OUTLIER',
  INTEGRITY_FAILURE: 'INTEGRITY_FAILURE',
  MANIPULATED: 'MANIPULATED'
};

const ConsensusStatus = {
  CONSENSUS_REACHED: 'CONSENSUS_REACHED',
  DISPUTE_QUORUM_FAILED: 'DISPUTE_QUORUM_FAILED',
  INSUFFICIENT_SOURCES: 'INSUFFICIENT_SOURCES',
  INTEGRITY_REJECTION: 'INTEGRITY_REJECTION'
};

module.exports = {
  OracleStatus,
  ConsensusStatus
};
