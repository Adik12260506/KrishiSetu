/**
 * Dynamic Product Registry
 * Allows non-engineers to launch and modify insurance products at runtime without code deployment.
 */

const { validatePolicySchema } = require('./policy_schema');

const DEFAULT_PRODUCTS = [
  {
    product_id: 'monsoon-drought-groundnut-v1',
    name: 'Kharif Groundnut Drought Shield',
    crop: 'Groundnut',
    region: 'Anantapur / Rayalaseema',
    season: 'Kharif 2026',
    premium_inr: 120,
    max_payout_inr: 5000,
    rainfall_threshold_mm: 35.0,
    measurement_window_days: 14,
    payout_formula: {
      type: 'LINEAR_PRO_RATA',
      threshold_mm: 35.0,
      exit_threshold_mm: 35.0,
      max_payout_inr: 5000
    },
    oracle_requirements: {
      min_sources: 2,
      max_stale_minutes: 180,
      max_allowed_variance_mm: 12.0
    },
    effective_from: '2026-06-01T00:00:00Z',
    effective_to: '2026-11-30T23:59:59Z',
    version: '1.0.0',
    description: 'Automatic parametric drought coverage for rainfed groundnut farmers. Payout scales linearly as rainfall drops below 35mm over 14 days.'
  },
  {
    product_id: 'kharif-paddy-deficit-v1',
    name: 'Paddy Critical Sowing Protection',
    crop: 'Paddy / Rice',
    region: 'Warangal / North Telangana',
    season: 'Kharif 2026',
    premium_inr: 250,
    max_payout_inr: 10000,
    rainfall_threshold_mm: 50.0,
    measurement_window_days: 21,
    payout_formula: {
      type: 'MULTI_TIER_DROUGHT',
      threshold_mm: 50.0,
      max_payout_inr: 10000,
      tiers: [
        { max_rain: 15, payout_pct: 1.0 },
        { max_rain: 30, payout_pct: 0.6 },
        { max_rain: 50, payout_pct: 0.3 }
      ]
    },
    oracle_requirements: {
      min_sources: 2,
      max_stale_minutes: 180,
      max_allowed_variance_mm: 15.0
    },
    effective_from: '2026-06-01T00:00:00Z',
    effective_to: '2026-11-30T23:59:59Z',
    version: '1.0.0',
    description: 'Tiered parametric deficit coverage for critical nursery and transplanting stages.'
  }
];

class ProductRegistry {
  constructor(initialProducts = DEFAULT_PRODUCTS) {
    this.products = new Map();
    for (const p of initialProducts) {
      this.products.set(p.product_id, JSON.parse(JSON.stringify(p)));
    }
  }

  getProduct(productId) {
    const p = this.products.get(productId);
    return p ? JSON.parse(JSON.stringify(p)) : null;
  }

  listProducts() {
    return Array.from(this.products.values()).map(p => JSON.parse(JSON.stringify(p)));
  }

  registerProduct(productData) {
    const validation = validatePolicySchema(productData);
    if (!validation.valid) {
      throw new Error(`Policy Schema Validation Failed: ${validation.errors.join('; ')}`);
    }

    const clean = JSON.parse(JSON.stringify(productData));
    clean.registered_at = clean.registered_at || new Date().toISOString();
    this.products.set(clean.product_id, clean);
    return clean;
  }

  reset() {
    this.products.clear();
    for (const p of DEFAULT_PRODUCTS) {
      this.products.set(p.product_id, JSON.parse(JSON.stringify(p)));
    }
  }
}

// Global Singleton Registry
const globalProductRegistry = new ProductRegistry();

module.exports = {
  ProductRegistry,
  globalProductRegistry,
  DEFAULT_PRODUCTS
};
