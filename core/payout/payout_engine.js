/**
 * Deterministic Payout Decision Engine
 * Integrates: Policy + Multi-Oracle Aggregation -> Deterministic Settlement Decision
 */

const { aggregateOracles, ConsensusStatus } = require('../oracle/aggregation_engine');
const { evaluateFormula, roundCurrency } = require('../policy/formula_evaluator');

class PayoutEngine {
  constructor() {
    this.payoutRecords = new Map();
  }

  evaluatePayout({
    policy,
    oracleObservations,
    evalTimestampIso = new Date().toISOString(),
    policyBindingId = null,
    farmerId = 'farmer-001',
    deviceId = 'dev-sim-01'
  }) {
    if (!policy) {
      throw new Error('Policy definition is required for evaluation');
    }
    if (!oracleObservations || !Array.isArray(oracleObservations)) {
      throw new Error('Valid oracle observations array is required');
    }

    const evalTime = new Date(evalTimestampIso).toISOString();

    // 1. Run multi-oracle aggregation
    const oracleResult = aggregateOracles(oracleObservations, {
      min_sources: policy.oracle_requirements ? policy.oracle_requirements.min_sources : 2,
      max_stale_minutes: policy.oracle_requirements ? policy.oracle_requirements.max_stale_minutes : 180,
      max_allowed_variance_mm: policy.oracle_requirements ? policy.oracle_requirements.max_allowed_variance_mm : 12.0,
      reference_time_iso: evalTime
    });

    let decision = {
      decision_id: `DEC_${deterministicHash(policy.product_id, farmerId, evalTime)}`,
      payout_id: null,
      policy_id: policy.product_id,
      policy_version: policy.version,
      policy_name: policy.name,
      crop: policy.crop,
      region: policy.region,
      farmer_id: farmerId,
      device_id: deviceId,
      evaluated_at: evalTime,
      consensus_reached: oracleResult.consensus_reached,
      consensus_status: oracleResult.consensus_status,
      aggregated_rainfall_mm: oracleResult.aggregated_rainfall_mm,
      oracle_details: oracleResult,
      triggered: false,
      payout_amount_inr: 0,
      payout_ratio: 0,
      decision_reason: '',
      calculation_steps: [],
      reconstruction_trail: null
    };

    // 2. Check if oracle consensus was achieved
    if (!oracleResult.consensus_reached) {
      decision.triggered = false;
      decision.payout_amount_inr = 0;
      decision.decision_reason = `Payout halted: Oracle consensus failed (${oracleResult.dispute_reason})`;
      decision.calculation_steps = [
        'Oracle verification initiated',
        `Consensus failure: ${oracleResult.dispute_reason}`,
        'Safety rule triggered: Zero silent payout without valid oracle quorum'
      ];
      return decision;
    }

    // 3. Evaluate parametric formula
    try {
      const formulaResult = evaluateFormula(policy.payout_formula, oracleResult.aggregated_rainfall_mm);
      decision.triggered = formulaResult.triggered;
      decision.payout_amount_inr = formulaResult.payout_inr;
      decision.payout_ratio = formulaResult.payout_ratio;
      decision.calculation_steps = formulaResult.calculation_steps;

      if (formulaResult.triggered && formulaResult.payout_inr > 0) {
        decision.payout_id = `PAY_${deterministicHash(policy.product_id, farmerId, String(formulaResult.payout_inr), evalTime)}`;
        decision.decision_reason = `Parametric trigger met: Observed rain ${oracleResult.aggregated_rainfall_mm}mm <= threshold ${policy.rainfall_threshold_mm}mm. Payout: ₹${formulaResult.payout_inr}.`;
      } else {
        decision.decision_reason = `Condition not met: Observed rain ${oracleResult.aggregated_rainfall_mm}mm does not warrant payout under policy rules.`;
      }
    } catch (err) {
      decision.triggered = false;
      decision.payout_amount_inr = 0;
      decision.decision_reason = `Formula evaluation error: ${err.message}`;
    }

    if (decision.payout_id) {
      this.payoutRecords.set(decision.payout_id, decision);
    }

    return decision;
  }

  getPayout(payoutId) {
    return this.payoutRecords.get(payoutId) || null;
  }

  listPayouts() {
    return Array.from(this.payoutRecords.values());
  }

  reset() {
    this.payoutRecords.clear();
  }
}

function deterministicHash(...args) {
  const combined = args.join('::');
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

const globalPayoutEngine = new PayoutEngine();

module.exports = {
  PayoutEngine,
  globalPayoutEngine,
  deterministicHash
};
