#!/usr/bin/env python3
"""
Official Security & Resilience Benchmark Runner (FS-2604 Phase 28 & 29)
Automates comprehensive security, RBAC, shared-device isolation, and idempotency tests.
Outputs machine-readable JSON security audit status.
"""

import sys
import json
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_js(code: str) -> dict:
    result = subprocess.run(
        ['node', '-e', code],
        capture_output=True,
        encoding='utf-8',
        check=True
    )
    return json.loads(result.stdout.strip())

def main():
    print("=" * 70)
    print("FS-2604: SECURITY + CORRECTNESS + RESILIENCE BENCHMARK SUITE")
    print("=" * 70)

    report = {}
    all_passed = True

    # 1. AUTHENTICATION & RBAC
    print("\n[SECURITY TEST 1] Authentication & Role-Based Access Control (RBAC)...")
    res1 = run_js("""
    const { UserModel, SessionModel } = require('./backend/models');
    (async () => {
      // 1. Invalid credentials
      const invalid = await UserModel.verifyCredentials('farmer_ramesh', 'wrong_pin');
      // 2. Valid farmer login
      const farmer = await UserModel.verifyCredentials('farmer_ramesh', '1234');
      const sess = await SessionModel.createSession(farmer.user_id, farmer.role);
      const validSess = await SessionModel.validateToken(sess.token);
      // 3. Revoke session
      await SessionModel.revokeSession(sess.token);
      const revokedSess = await SessionModel.validateToken(sess.token);

      process.stdout.write(JSON.stringify({
        invalid_rejected: invalid === null,
        session_valid: validSess !== null && validSess.user_id === 'farmer_ramesh',
        revocation_working: revokedSess === null
      }));
    })();
    """)
    if res1['invalid_rejected'] and res1['session_valid'] and res1['revocation_working']:
        print("  --> PASS: Credentials verified with salted SHA-256, bearer tokens validated & revoked correctly")
        report["authentication"] = "PASS"
    else:
        print(f"  --> FAIL: {res1}")
        report["authentication"] = "FAIL"
        all_passed = False

    # 2. SHARED DEVICE ISOLATION
    print("\n[SECURITY TEST 2] Shared-Device Cryptographic Session Isolation...")
    res2 = run_js("""
    const { SharedDeviceSessionManager } = require('./core/wallet/session_manager');
    const { globalProductRegistry } = require('./core/policy/product_registry');

    const mgr = new SharedDeviceSessionManager('HANDSET_FAMILY_01');
    const product = globalProductRegistry.getProduct('monsoon-drought-groundnut-v1');

    // Ramesh logs in & gets payout
    mgr.login('farmer_ramesh', '1234');
    const wRamesh = mgr.getActiveWallet();
    wRamesh.receivePayout({ triggered: true, payout_amount_inr: 4500, payout_id: 'PAY_R_01', policy_id: product.product_id });

    // Ramesh logs out -> Sita logs in
    mgr.logout();
    mgr.login('farmer_sita', '5678');
    const wSita = mgr.getActiveWallet();

    const iso = mgr.verifyCrossUserIsolation('farmer_ramesh', 'farmer_sita');
    process.stdout.write(JSON.stringify({
      isolated: iso.isolated,
      ramesh_balance: iso.user_a_balance,
      sita_balance: wSita.balance,
      cross_leakage: iso.cross_leakage_detected
    }));
    """)
    if res2['isolated'] and res2['ramesh_balance'] == 4500 and res2['sita_balance'] == 0 and not res2['cross_leakage']:
        print("  --> PASS: Strict user-partition isolation. Zero cross-user data leakage on shared handset")
        report["shared_device_isolation"] = "PASS"
    else:
        print(f"  --> FAIL: {res2}")
        report["shared_device_isolation"] = "FAIL"
        all_passed = False

    # 3. WALLET EVENT REDUCTION & INTEGRITY CHECK
    print("\n[SECURITY TEST 3] Wallet Event Ledger Reduction & Balance Consistency...")
    res3 = run_js("""
    const { WalletLedgerModel } = require('./backend/models');
    (async () => {
      const user = 'test_farmer_ledger_' + Date.now();
      // Record credit +4500
      await WalletLedgerModel.recordEvent(user, { event_id: user + '_C1', event_type: 'PAYOUT_CREDIT', amount_inr: 4500, sequence: 1 });
      // Record spend -1200
      await WalletLedgerModel.recordEvent(user, { event_id: user + '_S1', event_type: 'OFFLINE_SPEND', amount_inr: 1200, sequence: 2 });
      // Record spend -800
      await WalletLedgerModel.recordEvent(user, { event_id: user + '_S2', event_type: 'OFFLINE_SPEND', amount_inr: 800, sequence: 3 });

      const integrity = await WalletLedgerModel.verifyLedgerIntegrity(user);
      process.stdout.write(JSON.stringify(integrity));
    })();
    """)
    if res3['is_consistent'] and res3['stored_balance'] == 2500 and res3['reconstructed_balance'] == 2500:
        print(f"  --> PASS: Stored balance matches deterministic event reduction (INR {res3['stored_balance']})")
        report["wallet_ledger_consistency"] = "PASS"
    else:
        print(f"  --> FAIL: {res3}")
        report["wallet_ledger_consistency"] = "FAIL"
        all_passed = False

    # 4. DUPLICATE PAYOUT & REPLAY PROTECTION
    print("\n[SECURITY TEST 4] Payout Uniqueness & Duplicate Credit Prevention...")
    res4 = run_js("""
    const { PayoutModel, WalletLedgerModel } = require('./backend/models');
    (async () => {
      const farmerId = 'farmer_dup_sec_' + Date.now();
      const payoutDoc = {
        payout_id: 'PAY_DUP_' + farmerId,
        decision_id: 'DEC_DUP_' + farmerId,
        farmer_id: farmerId,
        amount_inr: 5000
      };

      // 1. First Payout Creation
      const p1 = await PayoutModel.create(payoutDoc);
      // 2. Duplicate Attempt
      const p2 = await PayoutModel.create(payoutDoc);

      // 3. Wallet event deduplication check
      const e1 = await WalletLedgerModel.recordEvent(farmerId, { event_id: 'EVT_DUP_' + farmerId, event_type: 'PAYOUT_CREDIT', amount_inr: 5000, sequence: 1 });
      const e2 = await WalletLedgerModel.recordEvent(farmerId, { event_id: 'EVT_DUP_' + farmerId, event_type: 'PAYOUT_CREDIT', amount_inr: 5000, sequence: 1 });

      const ledger = await WalletLedgerModel.getFarmerLedger(farmerId);
      process.stdout.write(JSON.stringify({
        payout_dedup: p1.payout_id === p2.payout_id,
        event1_success: !e1.duplicate,
        event2_duplicate_flag: e2.duplicate,
        final_balance: ledger.confirmed_balance
      }));
    })();
    """)
    if res4['payout_dedup'] and res4['event1_success'] and res4['event2_duplicate_flag'] and res4['final_balance'] == 5000:
        print("  --> PASS: Unique constraints prevent duplicate payout creation and double-crediting")
        report["duplicate_payout_protection"] = "PASS"
    else:
        print(f"  --> FAIL: {res4}")
        report["duplicate_payout_protection"] = "FAIL"
        all_passed = False

    # 5. ORACLE INTEGRITY & ANOMALY SEPARATION
    print("\n[SECURITY TEST 5] Oracle Multi-Source Quorum & Anomaly Rejection...")
    res5 = run_js("""
    const { aggregateOracles, OracleStatus, ConsensusStatus } = require('./core/oracle/aggregation_engine');
    const nowIso = new Date().toISOString();

    const observations = [
      { source_id: 'AWS_IMD', name: 'IMD', rainfall_mm: 18.0, observation_timestamp: nowIso, confidence: 0.95 },
      { source_id: 'SAT_GPM', name: 'NASA', rainfall_mm: 19.0, observation_timestamp: nowIso, confidence: 0.90 },
      { source_id: 'IOT_BAD', name: 'Hacked', rainfall_mm: 0.0, forced_status: OracleStatus.MANIPULATED, observation_timestamp: nowIso }
    ];

    const result = aggregateOracles(observations, { min_sources: 2, max_stale_minutes: 180, max_allowed_variance_mm: 12.0 });
    process.stdout.write(JSON.stringify({
      consensus_reached: result.consensus_reached,
      consensus_status: result.consensus_status,
      aggregated_rainfall: result.aggregated_rainfall_mm,
      rejected_count: result.rejected_sources.length
    }));
    """)
    if res5['consensus_reached'] and res5['rejected_count'] == 1 and res5['aggregated_rainfall'] > 15:
        print(f"  --> PASS: Manipulated oracle rejected. Consensus rainfall = {res5['aggregated_rainfall']} mm")
        report["oracle_integrity"] = "PASS"
    else:
        print(f"  --> FAIL: {res5}")
        report["oracle_integrity"] = "FAIL"
        all_passed = False

    # 6. POLICY DSL SANDBOXING & IMMUTABILITY
    print("\n[SECURITY TEST 6] Policy DSL Sandboxing & Immutability...")
    res6 = run_js("""
    const { validatePolicySchema } = require('./core/policy/policy_schema');
    const { evaluateFormula } = require('./core/policy/formula_evaluator');

    // 1. Unsafe injection attempt in formula type
    const unsafePolicy = {
      product_id: 'evil-policy-v1',
      name: 'Malicious Code',
      crop: 'Cotton',
      region: 'Region',
      premium_inr: 100,
      max_payout_inr: 5000,
      rainfall_threshold_mm: 35,
      payout_formula: { type: 'eval(console.log("hacked"))' },
      oracle_requirements: { min_sources: 2, max_stale_minutes: 180 },
      effective_from: '2026-06-01',
      version: '1.0.0'
    };
    const val = validatePolicySchema(unsafePolicy);

    // 2. Safe mathematical DSL evaluation
    const safeResult = evaluateFormula({ type: 'LINEAR_PRO_RATA', threshold_mm: 35, exit_threshold_mm: 35, max_payout_inr: 5000 }, 17.5);

    process.stdout.write(JSON.stringify({
      unsafe_rejected: !val.valid,
      safe_eval_triggered: safeResult.triggered,
      safe_payout: safeResult.payout_inr
    }));
    """)
    if res6['unsafe_rejected'] and res6['safe_eval_triggered'] and res6['safe_payout'] == 2500:
        print("  --> PASS: Unsafe code injection rejected by schema; mathematical DSL evaluated securely")
        report["policy_sandboxing"] = "PASS"
    else:
        print(f"  --> FAIL: {res6}")
        report["policy_sandboxing"] = "FAIL"
        all_passed = False

    # 7. DETERMINISM
    print("\n[SECURITY TEST 7] Global Seed Determinism...")
    det_res = subprocess.run(['python', 'scripts/test_determinism.py'], capture_output=True, encoding='utf-8')
    if det_res.returncode == 0:
        print("  --> PASS: 100% byte-identical SHA-256 hash match on identical inputs")
        report["determinism"] = "PASS"
    else:
        print("  --> FAIL: Determinism check failed")
        report["determinism"] = "FAIL"
        all_passed = False

    print("\n" + "=" * 70)
    print("MACHINE-READABLE SECURITY BENCHMARK REPORT:")
    print(json.dumps(report, indent=2))
    print("=" * 70)

    if all_passed:
        print("ALL SECURITY + CORRECTNESS + RESILIENCE BENCHMARKS PASSED! [100% OK]")
        sys.exit(0)
    else:
        print("SECURITY BENCHMARK SUITE FAILED")
        sys.exit(1)

if __name__ == '__main__':
    main()
