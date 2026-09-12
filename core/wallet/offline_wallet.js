/**
 * Offline-First Secure Local Wallet
 * Operates with ZERO connectivity. Maintains spendable balance,
 * monotonic sequence counter, tamper-resistant event journal, and pending sync queue.
 */

class OfflineWallet {
  constructor(farmerId, deviceId = 'dev-sim-01', initialBalance = 0) {
    this.farmerId = farmerId;
    this.deviceId = deviceId;
    this.balance = initialBalance;
    this.sequence = 0; // Monotonic sequence counter
    this.journal = []; // Immutable local event journal
    this.pendingSyncEvents = []; // Events awaiting upload to backend
    this.policies = new Map(); // Locally bound active policies
  }

  // Monotonically increment sequence
  _nextSequence() {
    this.sequence += 1;
    return this.sequence;
  }

  // Bind a local policy
  bindPolicy(policy, effectiveDateIso = new Date().toISOString()) {
    const seq = this._nextSequence();
    const event = {
      event_type: 'POLICY_BIND',
      event_id: `EVT_BIND_${this.deviceId}_${seq}`,
      farmer_id: this.farmerId,
      device_id: this.deviceId,
      policy_id: policy.product_id,
      policy_version: policy.version,
      premium_inr: policy.premium_inr,
      sequence: seq,
      timestamp: effectiveDateIso,
      integrity_hash: generateEventHash(this.farmerId, 'POLICY_BIND', policy.product_id, seq)
    };

    this.policies.set(policy.product_id, {
      ...policy,
      bound_at: effectiveDateIso,
      status: 'ACTIVE'
    });

    this.journal.push(event);
    this.pendingSyncEvents.push(event);
    return event;
  }

  // Receive local or authorized payout
  receivePayout(payoutDecision) {
    if (!payoutDecision || !payoutDecision.triggered || payoutDecision.payout_amount_inr <= 0) {
      return null;
    }

    const seq = this._nextSequence();
    const amount = Number(payoutDecision.payout_amount_inr);
    this.balance += amount;

    const event = {
      event_type: 'PAYOUT_CREDIT',
      event_id: `EVT_PAY_${this.deviceId}_${seq}`,
      payout_id: payoutDecision.payout_id,
      farmer_id: this.farmerId,
      device_id: this.deviceId,
      policy_id: payoutDecision.policy_id,
      amount_inr: amount,
      balance_after: this.balance,
      sequence: seq,
      timestamp: payoutDecision.evaluated_at || new Date().toISOString(),
      integrity_hash: generateEventHash(this.farmerId, 'PAYOUT_CREDIT', payoutDecision.payout_id, seq)
    };

    this.journal.push(event);
    this.pendingSyncEvents.push(event);
    return event;
  }

  // Spend funds locally offline (e.g. at Agri-Input Seed / Fertilizer Merchant)
  spendOffline(amountInr, merchantId = 'MERCHANT_AGRI_INPUT_01', purpose = 'Kharif Certified Seeds') {
    const amt = Number(amountInr);
    if (amt <= 0) {
      throw new Error('Spend amount must be positive');
    }
    if (amt > this.balance) {
      throw new Error(`Insufficient offline balance. Available: ₹${this.balance}, Attempted: ₹${amt}`);
    }

    const seq = this._nextSequence();
    this.balance -= amt;

    const event = {
      event_type: 'OFFLINE_SPEND',
      event_id: `EVT_SPEND_${this.deviceId}_${seq}`,
      farmer_id: this.farmerId,
      device_id: this.deviceId,
      merchant_id: merchantId,
      purpose: purpose,
      amount_inr: amt,
      balance_after: this.balance,
      sequence: seq,
      timestamp: new Date().toISOString(),
      integrity_hash: generateEventHash(this.farmerId, 'OFFLINE_SPEND', merchantId, seq)
    };

    this.journal.push(event);
    this.pendingSyncEvents.push(event);
    return event;
  }

  getPendingSyncPayload() {
    return [...this.pendingSyncEvents];
  }

  acknowledgeSync(syncedSequence) {
    this.pendingSyncEvents = this.pendingSyncEvents.filter(e => e.sequence > syncedSequence);
  }

  getState() {
    return {
      farmer_id: this.farmerId,
      device_id: this.deviceId,
      balance_inr: this.balance,
      sequence: this.sequence,
      journal_length: this.journal.length,
      pending_sync_count: this.pendingSyncEvents.length,
      active_policies: Array.from(this.policies.values())
    };
  }
}

function generateEventHash(farmerId, eventType, targetId, seq) {
  const raw = `${farmerId}|${eventType}|${targetId}|${seq}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

module.exports = {
  OfflineWallet,
  generateEventHash
};
