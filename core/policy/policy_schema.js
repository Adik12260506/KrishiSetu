/**
 * Policy Schema Validator
 * Validates parametric insurance product definitions
 */

function validatePolicySchema(product) {
  const errors = [];

  if (!product || typeof product !== 'object') {
    return { valid: false, errors: ['Product definition must be a valid JSON object'] };
  }

  const requiredFields = [
    'product_id',
    'name',
    'crop',
    'region',
    'premium_inr',
    'max_payout_inr',
    'rainfall_threshold_mm',
    'payout_formula',
    'oracle_requirements',
    'effective_from',
    'version'
  ];

  for (const field of requiredFields) {
    if (product[field] === undefined || product[field] === null || product[field] === '') {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  if (typeof product.premium_inr !== 'number' || product.premium_inr <= 0) {
    errors.push('premium_inr must be a positive number');
  }

  if (typeof product.max_payout_inr !== 'number' || product.max_payout_inr <= 0) {
    errors.push('max_payout_inr must be a positive number');
  }

  if (typeof product.rainfall_threshold_mm !== 'number' || product.rainfall_threshold_mm < 0) {
    errors.push('rainfall_threshold_mm must be a non-negative number');
  }

  if (product.payout_formula) {
    const validFormulaTypes = ['STEP_THRESHOLD', 'LINEAR_PRO_RATA', 'MULTI_TIER_DROUGHT', 'EXCESS_RAIN_LINEAR'];
    if (!validFormulaTypes.includes(product.payout_formula.type)) {
      errors.push(`payout_formula.type must be one of: ${validFormulaTypes.join(', ')}`);
    }
  }

  if (product.oracle_requirements) {
    if (typeof product.oracle_requirements.min_sources !== 'number' || product.oracle_requirements.min_sources < 2) {
      errors.push('oracle_requirements.min_sources must be at least 2');
    }
    if (typeof product.oracle_requirements.max_stale_minutes !== 'number' || product.oracle_requirements.max_stale_minutes <= 0) {
      errors.push('oracle_requirements.max_stale_minutes must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validatePolicySchema
};
