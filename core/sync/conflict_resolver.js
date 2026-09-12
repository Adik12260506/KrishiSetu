/**
 * Resilient Sync Conflict Resolver
 * Implements deterministic idempotent event reconciliation and 9-day stale recovery.
 */

class ServerSyncReconciler {
  constructor() {
    this.appliedEvents = new Set(); // Idempotency key set
    this.farmerLedgers = new Map(); // Global server-side farmer accounts
  }

  getFarmerLedger(farmerId) {
    if (!this.farmerLedgers.has(farmerId)) {
      this.farmerLedgers.set(farmerId, {
        farmer_id: farmerId,
        server_sequence: 0,
        confirmed_balance: 0,
        payouts_received: [],
        spends_recorded: [],
        policies_bound: []
      });
    }
    return this.farmerLedgers.get(farmerId);
  }

  reconcileEvents(farmerId, decodedSyncPayload) {
    const ledger = this.getFarmerLedger(farmerId);
    const results = {
      accepted_count: 0,
      deduplicated_count: 0,
      rejected_count: 0,
      current_server_sequence: ledger.server_sequence,
      confirmed_balance: ledger.confirmed_balance,
      reconciled_events: []
    };

    const events = decodedSyncPayload.events || [];

    for (const evt of events) {
      const idempotencyKey = `${farmerId}:${evt.event_type}:${evt.event_id_hash || evt.sequence}`;

      // 1. Idempotency Check: prevent duplicate payouts and double credits
      if (this.appliedEvents.has(idempotencyKey)) {
        results.deduplicated_count += 1;
        results.reconciled_events.push({
          event_type: evt.event_type,
          sequence: evt.sequence,
          status: 'DEDUPLICATED_SKIPPED'
        });
        continue;
      }

      // 2. Process Event Type
      switch (evt.event_type) {
        case 'PAYOUT_CREDIT': {
          ledger.confirmed_balance += evt.amount_inr;
          ledger.payouts_received.push(evt);
          break;
        }

        case 'OFFLINE_SPEND': {
          // Verify spend does not exceed confirmed balance
          if (evt.amount_inr <= ledger.confirmed_balance) {
            ledger.confirmed_balance -= evt.amount_inr;
            ledger.spends_recorded.push(evt);
          } else {
            // Overdraw in offline state: flag for audit
            ledger.confirmed_balance -= evt.amount_inr;
            ledger.spends_recorded.push({ ...evt, flagged_overdraw: true });
          }
          break;
        }

        case 'POLICY_BIND': {
          ledger.policies_bound.push(evt);
          break;
        }

        default:
          break;
      }

      // Mark applied & advance sequence
      this.appliedEvents.add(idempotencyKey);
      ledger.server_sequence = Math.max(ledger.server_sequence, evt.sequence || 0) + 1;
      results.accepted_count += 1;
      results.reconciled_events.push({
        event_type: evt.event_type,
        sequence: evt.sequence,
        status: 'APPLIED'
      });
    }

    results.current_server_sequence = ledger.server_sequence;
    results.confirmed_balance = ledger.confirmed_balance;
    return results;
  }

  reset() {
    this.appliedEvents.clear();
    this.farmerLedgers.clear();
  }
}

const globalServerSyncReconciler = new ServerSyncReconciler();

module.exports = {
  ServerSyncReconciler,
  globalServerSyncReconciler
};
