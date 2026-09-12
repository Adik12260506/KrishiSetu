/**
 * Payout Reconstruction Trail
 * Provides transparent, deterministic, step-by-step audit graphs for Jurors
 * and accessible "Why did I get this payout?" explanations for farmers.
 */

function buildReconstructionTrail(decision, policy, walletEvent = null) {
  if (!decision) return null;

  const steps = [];

  // Step 1: Policy Identification
  steps.push({
    step_index: 1,
    stage: 'POLICY_SPECIFICATION',
    title: 'Policy Configuration & Thresholds',
    status: 'COMPLETED',
    timestamp: decision.evaluated_at,
    details: {
      product_id: decision.policy_id,
      policy_name: decision.policy_name,
      crop: decision.crop,
      region: decision.region,
      rainfall_threshold_mm: policy ? policy.rainfall_threshold_mm : null,
      max_payout_inr: policy ? policy.max_payout_inr : null,
      payout_formula_type: policy && policy.payout_formula ? policy.payout_formula.type : null
    },
    narrative: `Policy ${decision.policy_name} covers ${decision.crop} in ${decision.region} with threshold ${policy ? policy.rainfall_threshold_mm : ''}mm.`
  });

  // Step 2: Multi-Oracle Raw Ingestion
  const oracleDetails = decision.oracle_details || {};
  const allSources = oracleDetails.all_sources || [];

  steps.push({
    step_index: 2,
    stage: 'ORACLE_INGESTION',
    title: 'Multi-Source Rainfall Ingestion',
    status: 'COMPLETED',
    timestamp: decision.evaluated_at,
    details: {
      sources_evaluated: allSources.map(s => ({
        source_id: s.source_id,
        name: s.name,
        type: s.type,
        rainfall_recorded_mm: s.rainfall_mm,
        age_minutes: s.age_minutes,
        signature: s.signature
      }))
    },
    narrative: `Ingested ${allSources.length} independent rainfall observations across ground weather stations, satellite grids, and local sensors.`
  });

  // Step 3: Oracle Validation & Outlier Rejection
  const rejectedSources = oracleDetails.rejected_sources || [];
  const agreeingSources = oracleDetails.agreeing_sources || [];

  steps.push({
    step_index: 3,
    stage: 'ORACLE_VALIDATION_AND_CONSENSUS',
    title: 'Dispute Resolution & Consensus Quorum',
    status: decision.consensus_reached ? 'COMPLETED' : 'REJECTED',
    timestamp: decision.evaluated_at,
    details: {
      consensus_status: decision.consensus_status,
      consensus_reached: decision.consensus_reached,
      agreeing_sources_count: agreeingSources.length,
      agreeing_sources: agreeingSources,
      rejected_sources_count: rejectedSources.length,
      rejected_sources: rejectedSources.map(r => ({
        source_id: r.source_id,
        rainfall_mm: r.rainfall_mm,
        status: r.health_status,
        reason: r.rejection_reason
      })),
      aggregated_rainfall_mm: decision.aggregated_rainfall_mm
    },
    narrative: decision.consensus_reached
      ? `Consensus reached with ${agreeingSources.length} agreeing sources. Verified aggregated rainfall = ${decision.aggregated_rainfall_mm}mm. ${rejectedSources.length} anomalous/stale sources rejected.`
      : `Consensus FAILED: ${oracleDetails.dispute_reason}. System halts automatic payout to prevent fraudulent or unverified transfer.`
  });

  // Step 4: Formula Evaluation
  steps.push({
    step_index: 4,
    stage: 'PARAMETRIC_FORMULA_EVALUATION',
    title: 'Deterministic Loss Calculation',
    status: decision.triggered ? 'TRIGGERED' : 'NO_TRIGGER',
    timestamp: decision.evaluated_at,
    details: {
      rainfall_mm: decision.aggregated_rainfall_mm,
      threshold_mm: policy ? policy.rainfall_threshold_mm : null,
      triggered: decision.triggered,
      payout_ratio: decision.payout_ratio,
      calculated_amount_inr: decision.payout_amount_inr,
      steps: decision.calculation_steps || []
    },
    narrative: decision.triggered
      ? `Rainfall deficit triggered policy: ${decision.aggregated_rainfall_mm}mm <= ${policy ? policy.rainfall_threshold_mm : ''}mm. Payout evaluated at ₹${decision.payout_amount_inr} (${(decision.payout_ratio * 100).toFixed(0)}% of max).`
      : `Rainfall did not breach trigger threshold. No payout required.`
  });

  // Step 5: Offline Wallet Credit
  if (decision.triggered && decision.payout_amount_inr > 0) {
    steps.push({
      step_index: 5,
      stage: 'WALLET_SETTLEMENT',
      title: 'Offline Wallet Authorization',
      status: 'CREDITED',
      timestamp: decision.evaluated_at,
      details: {
        payout_id: decision.payout_id,
        farmer_id: decision.farmer_id,
        device_id: decision.device_id,
        amount_credited_inr: decision.payout_amount_inr,
        spendable_offline: true,
        sequence_number: walletEvent ? walletEvent.sequence : 1
      },
      narrative: `₹${decision.payout_amount_inr} authorized and made instantly spendable in local offline wallet.`
    });
  }

  // Farmer Simple Narrative
  const farmerExplanation = generateFarmerExplanation(decision, policy);

  return {
    reconstruction_id: `REC_${decision.payout_id || decision.decision_id}`,
    decision_id: decision.decision_id,
    payout_id: decision.payout_id,
    evaluated_at: decision.evaluated_at,
    verdict: decision.triggered ? 'APPROVED_PAYOUT' : 'NO_PAYOUT',
    total_amount_inr: decision.payout_amount_inr,
    steps: steps,
    farmer_explanation: farmerExplanation
  };
}

function generateFarmerExplanation(decision, policy) {
  if (!decision.consensus_reached) {
    return {
      title_en: 'Rainfall data could not be verified safely',
      title_hi: 'बारिश के आंकड़ों का सत्यापन नहीं हो सका',
      title_te: 'వర్షపాతం వివరాలు ధృవీకరించబడలేదు',
      summary_en: `Weather stations reported conflicting or stale data. Payout is paused to protect your policy. Our team will verify.`,
      summary_hi: `मौसम केंद्रों से मिलने वाले आंकड़ों में असंगति पाई गई। आपकी सुरक्षा के लिए भुगतान रोका गया है।`,
      summary_te: `వాతావరణ కేంద్రాల వివరాలలో తేడా ఉంది. మీ క్లెయిమ్ సురక్షితంగా పరిశీలనలో ఉంది.`
    };
  }

  if (!decision.triggered) {
    return {
      title_en: 'Rainfall was adequate for your crop',
      title_hi: 'आपकी फसल के लिए बारिश पर्याप्त थी',
      title_te: 'మీ పంటకు సరిపడా వర్షపాతం నమోదైంది',
      summary_en: `Verified rainfall was ${decision.aggregated_rainfall_mm}mm, which is above the drought trigger of ${policy ? policy.rainfall_threshold_mm : ''}mm.`,
      summary_hi: `सत्यापित वर्षा ${decision.aggregated_rainfall_mm} मिमी दर्ज हुई, जो सूखा सीमा ${policy ? policy.rainfall_threshold_mm : ''} मिमी से अधिक है।`,
      summary_te: `నమోదైన వర్షపాతం ${decision.aggregated_rainfall_mm} మి.మీ. ఇది కరువు పరిమితి కంటే ఎక్కువ.`
    };
  }

  return {
    title_en: `₹${decision.payout_amount_inr} Claim Approved Automatically`,
    title_hi: `₹${decision.payout_amount_inr} का दावा स्वतः स्वीकृत`,
    title_te: `₹${decision.payout_amount_inr} బీమా మొత్తం ఆమోదించబడింది`,
    summary_en: `Rainfall in your area was only ${decision.aggregated_rainfall_mm}mm (below the ${policy ? policy.rainfall_threshold_mm : ''}mm threshold). Your payout of ₹${decision.payout_amount_inr} is credited to your offline wallet and spendable immediately.`,
    summary_hi: `आपके क्षेत्र में केवल ${decision.aggregated_rainfall_mm} मिमी बारिश हुई (सीमा ${policy ? policy.rainfall_threshold_mm : ''} मिमी से कम)। ₹${decision.payout_amount_inr} आपके वॉलेट में तुरंत जमा कर दिए गए हैं।`,
    summary_te: `మీ ప్రాంతంలో కేవలం ${decision.aggregated_rainfall_mm} మి.మీ వర్షం పడింది. మీ ఖాతాలో ₹${decision.payout_amount_inr} జమ చేయబడింది.`
  };
}

module.exports = {
  buildReconstructionTrail,
  generateFarmerExplanation
};
