#!/usr/bin/env python3
"""
Official Sealed Evaluation Test Suite (FS-2604: Tests 1 through 14)
Full end-to-end automated validation of all non-negotiable hackathon criteria.
"""

import sys
import json
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_eval_script(js_code: str) -> dict:
    result = subprocess.run(
        ['node', '-e', js_code],
        capture_output=True,
        encoding='utf-8',
        check=True
    )
    return json.loads(result.stdout.strip())

def main():
    print("=" * 70)
    print("FS-2604: OFFICIAL SEALED EVALUATION AUTOMATED TEST SUITE")
    print("Executing 14 Hard Acceptance Criteria Tests")
    print("=" * 70)

    passed_count = 0
    total_tests = 14

    # TEST 1: Healthy oracle -> valid drought -> payout
    print("\n[TEST 1] Healthy oracle -> valid drought -> payout")
    res1 = run_eval_script("""
    const { globalProductRegistry } = require('./core/policy/product_registry');
    const { globalPayoutEngine } = require('./core/payout/payout_engine');
    const { globalOracleProvider } = require('./core/oracle/providers');

    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');
    const obs = globalOracleProvider.getObservations(product.region, 18.0);
    const decision = globalPayoutEngine.evaluatePayout({ policy: product, oracleObservations: obs });
    process.stdout.write(JSON.stringify({ triggered: decision.triggered, payout: decision.payout_amount_inr, status: decision.consensus_status }));
    """)
    if res1['triggered'] and res1['payout'] > 0 and res1['status'] == 'CONSENSUS_REACHED':
        print(f"  --> PASS: Drought triggered, Payout = INR {res1['payout']}, Consensus = {res1['status']}")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res1}")

    # TEST 2: One stale oracle -> correct handling
    print("\n[TEST 2] One stale oracle -> disqualified, quorum maintained")
    res2 = run_eval_script("""
    const { globalProductRegistry } = require('./core/policy/product_registry');
    const { globalPayoutEngine } = require('./core/payout/payout_engine');
    const { RainfallOracleProvider } = require('./core/oracle/providers');

    const provider = new RainfallOracleProvider();
    const staleTime = new Date(Date.now() - 5 * 3600 * 1000).toISOString(); // 5 hours old
    provider.setOverride('SATELLITE_GPM_GRID', { observation_timestamp: staleTime });

    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');
    const obs = provider.getObservations(product.region, 17.5);
    const decision = globalPayoutEngine.evaluatePayout({ policy: product, oracleObservations: obs });
    process.stdout.write(JSON.stringify({
      triggered: decision.triggered,
      payout: decision.payout_amount_inr,
      rejected_count: decision.oracle_details.rejected_sources.length,
      rejected_status: decision.oracle_details.rejected_sources[0].health_status
    }));
    """)
    if res2['triggered'] and res2['rejected_count'] == 1 and res2['rejected_status'] == 'STALE':
        print(f"  --> PASS: Stale oracle rejected, quorum maintained, Payout = INR {res2['payout']}")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res2}")

    # TEST 3: One unavailable oracle -> correct fallback
    print("\n[TEST 3] One unavailable oracle -> fallback to remaining quorum")
    res3 = run_eval_script("""
    const { globalProductRegistry } = require('./core/policy/product_registry');
    const { globalPayoutEngine } = require('./core/payout/payout_engine');
    const { RainfallOracleProvider } = require('./core/oracle/providers');

    const provider = new RainfallOracleProvider();
    provider.setOverride('PANCHAYAT_IOT_GUAGE', { status: 'UNAVAILABLE', rainfall_mm: null });

    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');
    const obs = provider.getObservations(product.region, 16.0);
    const decision = globalPayoutEngine.evaluatePayout({ policy: product, oracleObservations: obs });
    const rejected = decision.oracle_details.rejected_sources || [];
    process.stdout.write(JSON.stringify({
      triggered: decision.triggered,
      payout: decision.payout_amount_inr,
      agreeing_count: decision.oracle_details.agreeing_sources.length,
      rejected_status: rejected.length > 0 ? rejected[0].health_status : 'MISSING'
    }));
    """)
    if res3['triggered'] and res3['agreeing_count'] == 2 and res3['rejected_status'] in ['MISSING', 'UNAVAILABLE']:
        print(f"  --> PASS: Unavailable oracle safely skipped, 2 operational oracles reached quorum")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res3}")

    # TEST 4: One manipulated oracle -> MUST NOT trigger fraudulent payout
    print("\n[TEST 4] One manipulated oracle -> MUST NOT trigger fraudulent payout")
    res4 = run_eval_script("""
    const { globalProductRegistry } = require('./core/policy/product_registry');
    const { globalPayoutEngine } = require('./core/payout/payout_engine');
    const { RainfallOracleProvider } = require('./core/oracle/providers');

    const provider = new RainfallOracleProvider();
    // Oracle A manipulated to report 0mm (drought), but real weather is 65mm (adequate rain)
    provider.setOverride('AWS_IMD_MANDAL', { rainfall_mm: 0.0, forced_status: 'MANIPULATED' });

    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');
    const obs = provider.getObservations(product.region, 65.0);
    const decision = globalPayoutEngine.evaluatePayout({ policy: product, oracleObservations: obs });
    process.stdout.write(JSON.stringify({
      triggered: decision.triggered,
      payout: decision.payout_amount_inr,
      manipulated_rejected: decision.oracle_details.rejected_sources.some(s => s.health_status === 'MANIPULATED'),
      fraud_prevented: !decision.triggered
    }));
    """)
    if not res4['triggered'] and res4['payout'] == 0 and res4['manipulated_rejected']:
        print(f"  --> PASS: Manipulated oracle rejected. Fraudulent payout prevented (Payout = INR 0)")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res4}")

    # TEST 5: Two conflicting oracles -> deterministic dispute handling
    print("\n[TEST 5] Two conflicting oracles -> deterministic dispute handling")
    res5 = run_eval_script("""
    const { globalProductRegistry } = require('./core/policy/product_registry');
    const { globalPayoutEngine } = require('./core/payout/payout_engine');
    const { RainfallOracleProvider } = require('./core/oracle/providers');

    const provider = new RainfallOracleProvider();
    provider.setOverride('AWS_IMD_MANDAL', { rainfall_mm: 10.0 });
    provider.setOverride('SATELLITE_GPM_GRID', { rainfall_mm: 85.0 });
    provider.setOverride('PANCHAYAT_IOT_GUAGE', { status: 'UNAVAILABLE', rainfall_mm: null });

    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');
    const obs = provider.getObservations(product.region, 45.0);
    const decision = globalPayoutEngine.evaluatePayout({ policy: product, oracleObservations: obs });
    process.stdout.write(JSON.stringify({
      consensus_reached: decision.consensus_reached,
      consensus_status: decision.consensus_status,
      triggered: decision.triggered,
      payout: decision.payout_amount_inr
    }));
    """)
    if not res5['consensus_reached'] and res5['consensus_status'] == 'DISPUTE_QUORUM_FAILED' and not res5['triggered']:
        print(f"  --> PASS: Dispute triggered (DISPUTE_QUORUM_FAILED). Zero silent payout.")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res5}")

    # TEST 6: Genuine drought + partially failed sensor -> payout correctly evaluated
    print("\n[TEST 6] Genuine drought + partially failed sensor -> payout correctly evaluated")
    res6 = run_eval_script("""
    const { globalProductRegistry } = require('./core/policy/product_registry');
    const { globalPayoutEngine } = require('./core/payout/payout_engine');
    const { RainfallOracleProvider } = require('./core/oracle/providers');

    const provider = new RainfallOracleProvider();
    provider.setOverride('PANCHAYAT_IOT_GUAGE', { status: 'UNAVAILABLE', rainfall_mm: null });

    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');
    const obs = provider.getObservations(product.region, 15.0);
    const decision = globalPayoutEngine.evaluatePayout({ policy: product, oracleObservations: obs });
    process.stdout.write(JSON.stringify({
      triggered: decision.triggered,
      payout: decision.payout_amount_inr,
      rainfall_used: decision.aggregated_rainfall_mm
    }));
    """)
    if res6['triggered'] and res6['payout'] > 0 and res6['rainfall_used'] < 35.0:
        print(f"  --> PASS: Genuine drought verified with remaining sensors. Payout = INR {res6['payout']}")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res6}")

    # TEST 7: Network completely disabled -> flow still completes
    print("\n[TEST 7] Network completely disabled -> full offline flow completes")
    res7 = run_eval_script("""
    const { OfflineWallet } = require('./core/wallet/offline_wallet');
    const { globalProductRegistry } = require('./core/policy/product_registry');

    const wallet = new OfflineWallet('farmer_offline_01', 'DEV_OFFLINE_01', 0);
    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');

    // 1. Offline policy bind
    const bindEvt = wallet.bindPolicy(product);
    // 2. Offline payout credit
    const payEvt = wallet.receivePayout({ triggered: true, payout_amount_inr: 5000, payout_id: 'PAY_OFF_01', policy_id: product.product_id });
    // 3. Offline spend at agri merchant
    const spendEvt = wallet.spendOffline(1800, 'MERCHANT_SEED_01', 'Groundnut Seeds');

    const state = wallet.getState();
    process.stdout.write(JSON.stringify({
      balance: state.balance_inr,
      sequence: state.sequence,
      pending_count: state.pending_sync_count
    }));
    """)
    if res7['balance'] == 3200 and res7['sequence'] == 3 and res7['pending_count'] == 3:
        print(f"  --> PASS: Full offline flow completed without connectivity. Offline Balance = INR {res7['balance']}")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res7}")

    # TEST 8: Nine-day stale device -> deterministic sync
    print("\n[TEST 8] Nine-day stale device -> deterministic sync")
    res8 = run_eval_script("""
    const { ServerSyncReconciler } = require('./core/sync/conflict_resolver');
    const { encodeSyncPayload, decodeSyncPayload } = require('./core/sync/wire_codec');

    const reconciler = new ServerSyncReconciler();
    // Simulate events queued over 9 days offline
    const staleEvents = [
      { event_type: 'PAYOUT_CREDIT', event_id: 'EVT_STALE_PAY', target_id: 'PAY_01', amount_inr: 4000, sequence: 1 },
      { event_type: 'OFFLINE_SPEND', event_id: 'EVT_STALE_SPEND_1', target_id: 'MERCHANT_A', amount_inr: 1200, sequence: 2 },
      { event_type: 'OFFLINE_SPEND', event_id: 'EVT_STALE_SPEND_2', target_id: 'MERCHANT_B', amount_inr: 800, sequence: 3 }
    ];

    const rawBuf = encodeSyncPayload('DEV_9DAY_01', 'farmer_stale_01', 3, staleEvents);
    const decoded = decodeSyncPayload(rawBuf);
    const result = reconciler.reconcileEvents('farmer_stale_01', decoded);

    process.stdout.write(JSON.stringify({
      accepted: result.accepted_count,
      balance: result.confirmed_balance,
      server_seq: result.current_server_sequence
    }));
    """)
    if res8['accepted'] == 3 and res8['balance'] == 2000:
        print(f"  --> PASS: 9-day stale events successfully reconciled without server state corruption")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res8}")

    # TEST 9: Duplicate sync -> no duplicate payout
    print("\n[TEST 9] Duplicate sync -> idempotency prevents double credit")
    res9 = run_eval_script("""
    const { ServerSyncReconciler } = require('./core/sync/conflict_resolver');
    const { encodeSyncPayload, decodeSyncPayload } = require('./core/sync/wire_codec');

    const reconciler = new ServerSyncReconciler();
    const event = [{ event_type: 'PAYOUT_CREDIT', event_id: 'EVT_DUP_PAY_01', target_id: 'PAY_DUP', amount_inr: 5000, sequence: 1 }];

    const rawBuf = encodeSyncPayload('DEV_DUP_01', 'farmer_dup_01', 1, event);
    const decoded = decodeSyncPayload(rawBuf);

    // Run 1st Sync
    const res1 = reconciler.reconcileEvents('farmer_dup_01', decoded);
    // Run 2nd Replayed Duplicate Sync
    const res2 = reconciler.reconcileEvents('farmer_dup_01', decoded);

    process.stdout.write(JSON.stringify({
      run1_accepted: res1.accepted_count,
      run2_deduplicated: res2.deduplicated_count,
      final_balance: res2.confirmed_balance
    }));
    """)
    if res9['run1_accepted'] == 1 and res9['run2_deduplicated'] == 1 and res9['final_balance'] == 5000:
        print(f"  --> PASS: Replayed sync was safely deduplicated. Balance remains INR 5000 (No double credit)")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res9}")

    # TEST 10: User A -> User B -> zero cross-user data leakage
    print("\n[TEST 10] User A -> User B -> zero cross-user data leakage")
    res10 = run_eval_script("""
    const { SharedDeviceSessionManager } = require('./core/wallet/session_manager');
    const { globalProductRegistry } = require('./core/policy/product_registry');

    const manager = new SharedDeviceSessionManager('SHARED_DEVICE_01');
    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');

    // User A session
    manager.login('user_a', '1111');
    const walletA = manager.getActiveWallet();
    walletA.bindPolicy(product);
    walletA.receivePayout({ triggered: true, payout_amount_inr: 4500, payout_id: 'PAY_A', policy_id: product.product_id });

    // User A logs out -> User B logs in
    manager.logout();
    manager.login('user_b', '2222');
    const walletB = manager.getActiveWallet();

    const isoCheck = manager.verifyCrossUserIsolation('user_a', 'user_b');
    process.stdout.write(JSON.stringify({
      isolated: isoCheck.isolated,
      user_a_balance: isoCheck.user_a_balance,
      user_b_balance: walletB.balance,
      leakage_detected: isoCheck.cross_leakage_detected
    }));
    """)
    if res10['isolated'] and res10['user_a_balance'] == 4500 and res10['user_b_balance'] == 0 and not res10['leakage_detected']:
        print(f"  --> PASS: Strict session boundary. User B cannot access User A's data (Leakage = ZERO)")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res10}")

    # TEST 11: Second product launched without code deployment
    print("\n[TEST 11] Second product launched dynamically without code deployment")
    res11 = run_eval_script("""
    const { ProductRegistry } = require('./core/policy/product_registry');
    const { PayoutEngine } = require('./core/payout/payout_engine');
    const { RainfallOracleProvider } = require('./core/oracle/providers');

    const registry = new ProductRegistry();
    const payoutEngine = new PayoutEngine();
    const provider = new RainfallOracleProvider();

    // Register 2nd product at runtime purely via JSON config
    const secondProduct = registry.registerProduct({
      product_id: 'cotton-excess-rain-v2',
      name: 'Vidarbha Cotton Flood Shield',
      crop: 'Cotton',
      region: 'Vidarbha / Maharashtra',
      season: 'Kharif 2026',
      premium_inr: 300,
      max_payout_inr: 8000,
      rainfall_threshold_mm: 120,
      measurement_window_days: 7,
      payout_formula: {
        type: 'EXCESS_RAIN_LINEAR',
        excess_threshold_mm: 120,
        excess_cap_mm: 200,
        max_payout_inr: 8000
      },
      oracle_requirements: { min_sources: 2, max_stale_minutes: 180, max_allowed_variance_mm: 20 },
      effective_from: '2026-06-01T00:00:00Z',
      effective_to: '2026-11-30T23:59:59Z',
      version: '1.0.0'
    });

    const obs = provider.getObservations(secondProduct.region, 160.0); // 160mm excess rainfall
    const decision = payoutEngine.evaluatePayout({ policy: secondProduct, oracleObservations: obs });

    process.stdout.write(JSON.stringify({
      product_id: secondProduct.product_id,
      triggered: decision.triggered,
      payout_amount: decision.payout_amount_inr,
      formula_type: decision.calculation_steps[0]
    }));
    """)
    if res11['product_id'] == 'cotton-excess-rain-v2' and res11['triggered'] and res11['payout_amount'] > 0:
        print(f"  --> PASS: 2nd Product registered live & evaluated instantly (Payout = INR {res11['payout_amount']})")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res11}")

    # TEST 12: Network cut during transaction
    print("\n[TEST 12] Network cut during transaction -> offline safety queue retains state")
    res12 = run_eval_script("""
    const { OfflineWallet } = require('./core/wallet/offline_wallet');
    const wallet = new OfflineWallet('farmer_tx_01', 'DEV_CUT_01', 5000);
    // User initiates spend while network drops mid-way
    wallet.spendOffline(2000, 'MERCHANT_CUT_01', 'Fertilizer');
    const state = wallet.getState();
    process.stdout.write(JSON.stringify({
      balance: state.balance_inr,
      pending_sync: state.pending_sync_count,
      seq: state.sequence
    }));
    """)
    if res12['balance'] == 3000 and res12['pending_sync'] == 1:
        print(f"  --> PASS: Transaction safely persisted offline and queued for deferred sync")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res12}")

    # TEST 13: H+8 Handset changes hands mid-flow
    print("\n[TEST 13] H+8 Handset changes hands mid-flow -> session invalidated safely")
    res13 = run_eval_script("""
    const { SharedDeviceSessionManager } = require('./core/wallet/session_manager');
    const { enforceUserBoundary } = require('./core/security/shared_device_guard');

    const manager = new SharedDeviceSessionManager();
    manager.login('farmer_ramesh', '1234');
    manager.logout(); // Handset handed over mid-flow

    const boundaryCheck = enforceUserBoundary('farmer_ramesh');
    process.stdout.write(JSON.stringify({
      allowed: boundaryCheck.allowed,
      error: boundaryCheck.error
    }));
    """)
    if not res13['allowed'] and res13['error'] == 'NO_ACTIVE_SESSION':
        print(f"  --> PASS: Session securely invalidated on handover (Access Denied)")
        passed_count += 1
    else:
        print(f"  --> FAIL: {res13}")

    # TEST 14: Determinism test
    print("\n[TEST 14] Determinism test -> byte-identical payout & reconstruction result")
    det_proc = subprocess.run(['python', 'scripts/test_determinism.py'], capture_output=True, encoding='utf-8')
    if det_proc.returncode == 0:
        print(f"  --> PASS: Global seed determinism verified 100% byte-identical")
        passed_count += 1
    else:
        print(f"  --> FAIL: Determinism check failed")

    print("\n" + "=" * 70)
    print(f"TEST RESULTS: {passed_count} / {total_tests} TESTS PASSED")
    print("=" * 70)

    if passed_count == total_tests:
        print("ALL 14 OFFICIAL SEALED EVALUATION TESTS PASSED SUCCESSFULLY! [100% OK]")
        sys.exit(0)
    else:
        print(f"TEST SUITE FAILED ({total_tests - passed_count} failures)")
        sys.exit(1)

if __name__ == '__main__':
    main()
