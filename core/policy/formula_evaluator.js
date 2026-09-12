/**
 * Deterministic Parametric Payout Formula Evaluator
 * Scored path has zero non-deterministic or LLM dependencies.
 */

function roundCurrency(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function evaluateFormula(formulaConfig, observedRainfallMm) {
  const type = formulaConfig.type || 'STEP_THRESHOLD';
  const threshold = Number(formulaConfig.threshold_mm);
  const maxPayout = Number(formulaConfig.max_payout_inr);
  const rain = Number(observedRainfallMm);

  if (isNaN(rain) || rain < 0) {
    throw new Error(`Invalid observed rainfall: ${observedRainfallMm}`);
  }

  let triggered = false;
  let payout = 0;
  let ratio = 0;
  let calculationSteps = [];

  switch (type) {
    case 'STEP_THRESHOLD': {
      calculationSteps.push(`Evaluating STEP_THRESHOLD with rainfall: ${rain} mm, threshold: ${threshold} mm`);
      if (rain <= threshold) {
        triggered = true;
        payout = maxPayout;
        ratio = 1.0;
        calculationSteps.push(`Condition satisfied: rain (${rain}mm) <= threshold (${threshold}mm). Full payout triggered.`);
      } else {
        triggered = false;
        payout = 0;
        calculationSteps.push(`Condition not met: rain (${rain}mm) > threshold (${threshold}mm). Payout = ₹0.`);
      }
      break;
    }

    case 'LINEAR_PRO_RATA': {
      const exitThreshold = formulaConfig.exit_threshold_mm !== undefined ? Number(formulaConfig.exit_threshold_mm) : threshold;
      calculationSteps.push(`Evaluating LINEAR_PRO_RATA with rainfall: ${rain} mm, threshold: ${exitThreshold} mm, maxPayout: ₹${maxPayout}`);
      if (rain <= exitThreshold) {
        triggered = true;
        // Payout scales linearly from 0 at threshold to maxPayout at 0mm rain
        ratio = (exitThreshold - rain) / exitThreshold;
        ratio = Math.max(0, Math.min(1.0, ratio));
        payout = roundCurrency(maxPayout * ratio);
        calculationSteps.push(`Deficit ratio: ${roundCurrency(ratio * 100)}%. Calculated payout: ₹${payout}`);
      } else {
        triggered = false;
        payout = 0;
        calculationSteps.push(`Rainfall ${rain}mm is above threshold ${exitThreshold}mm. No payout.`);
      }
      break;
    }

    case 'MULTI_TIER_DROUGHT': {
      const tiers = formulaConfig.tiers || [
        { max_rain: 10, payout_pct: 1.0 },
        { max_rain: 25, payout_pct: 0.6 },
        { max_rain: 40, payout_pct: 0.3 }
      ];
      calculationSteps.push(`Evaluating MULTI_TIER_DROUGHT for rainfall ${rain} mm across ${tiers.length} tiers`);
      
      let matchedTier = null;
      for (const tier of tiers) {
        if (rain <= tier.max_rain) {
          if (!matchedTier || tier.payout_pct > matchedTier.payout_pct) {
            matchedTier = tier;
          }
        }
      }

      if (matchedTier && matchedTier.payout_pct > 0) {
        triggered = true;
        ratio = matchedTier.payout_pct;
        payout = roundCurrency(maxPayout * ratio);
        calculationSteps.push(`Matched tier: Rain <= ${matchedTier.max_rain}mm -> ${ratio * 100}% payout (₹${payout})`);
      } else {
        triggered = false;
        payout = 0;
        calculationSteps.push(`Rainfall ${rain}mm exceeds all drought tiers. No payout.`);
      }
      break;
    }

    case 'EXCESS_RAIN_LINEAR': {
      const floodThreshold = Number(formulaConfig.excess_threshold_mm || threshold);
      const capMm = Number(formulaConfig.excess_cap_mm || (floodThreshold + 100));
      calculationSteps.push(`Evaluating EXCESS_RAIN_LINEAR with rainfall: ${rain} mm, flood threshold: ${floodThreshold} mm`);
      
      if (rain >= floodThreshold) {
        triggered = true;
        ratio = (rain - floodThreshold) / Math.max(1, (capMm - floodThreshold));
        ratio = Math.max(0, Math.min(1.0, ratio));
        payout = roundCurrency(maxPayout * ratio);
        calculationSteps.push(`Excess severity: ${roundCurrency(ratio * 100)}%. Calculated payout: ₹${payout}`);
      } else {
        triggered = false;
        payout = 0;
        calculationSteps.push(`Rainfall ${rain}mm below flood threshold ${floodThreshold}mm. No payout.`);
      }
      break;
    }

    default:
      throw new Error(`Unsupported payout formula type: ${type}`);
  }

  return {
    triggered,
    payout_inr: payout,
    payout_ratio: roundCurrency(ratio),
    max_payout_inr: maxPayout,
    calculation_steps: calculationSteps,
    formula_type: type
  };
}

module.exports = {
  evaluateFormula,
  roundCurrency
};
