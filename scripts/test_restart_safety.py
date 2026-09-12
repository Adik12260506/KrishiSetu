#!/usr/bin/env python3
"""
Server Restart Safety & MongoDB Persistence Verification (FS-2604 Phase 1)
Validates:
1. Create policy & payout in Run 1
2. Terminate server / Node process completely
3. Start fresh Run 2
4. Verify policy, payout, and wallet history persist intact without data loss
"""

import sys
import json
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("=" * 65)
    print("FS-2604: SERVER RESTART SAFETY & PERSISTENCE TEST")
    print("=" * 65)

    test_product_id = "restart-test-shield-v1"
    test_farmer_id = "farmer_restart_01"

    # Step 1: Run in Process 1
    print("\n[STEP 1] Creating policy and payout in Process 1...")
    p1_code = f"""
    const {{ PolicyModel, PayoutModel, WalletLedgerModel }} = require('./backend/models');
    (async () => {{
      // Create product
      await PolicyModel.createOrUpdate({{
        product_id: '{test_product_id}',
        name: 'Restart Safety Shield',
        crop: 'Soybean',
        region: 'Vidarbha',
        premium_inr: 150,
        max_payout_inr: 6000,
        rainfall_threshold_mm: 30,
        version: '1.0.0'
      }});

      // Create payout
      await PayoutModel.create({{
        payout_id: 'PAY_RESTART_999',
        decision_id: 'DEC_RESTART_999',
        farmer_id: '{test_farmer_id}',
        policy_id: '{test_product_id}',
        amount_inr: 4500
      }});

      // Record wallet credit event
      await WalletLedgerModel.recordEvent('{test_farmer_id}', {{
        event_id: 'EVT_RESTART_01',
        event_type: 'PAYOUT_CREDIT',
        amount_inr: 4500,
        sequence: 1
      }});

      process.stdout.write(JSON.stringify({{ success: true }}));
    }})();
    """

    res1 = subprocess.run(['node', '-e', p1_code], capture_output=True, encoding='utf-8', check=True)
    print("  --> Process 1 executed and terminated successfully.")

    # Step 2: Fresh Process 2 (simulates server restart)
    print("\n[STEP 2] Simulating server restart in fresh Process 2 and reading state...")
    p2_code = f"""
    const {{ PolicyModel, PayoutModel, WalletLedgerModel }} = require('./backend/models');
    (async () => {{
      const product = await PolicyModel.getById('{test_product_id}');
      const payout = await PayoutModel.getById('PAY_RESTART_999');
      const ledger = await WalletLedgerModel.getFarmerLedger('{test_farmer_id}');
      const integrity = await WalletLedgerModel.verifyLedgerIntegrity('{test_farmer_id}');

      process.stdout.write(JSON.stringify({{
        product_found: product !== null && product.name === 'Restart Safety Shield',
        payout_found: payout !== null && payout.amount_inr === 4500,
        balance_intact: ledger.confirmed_balance === 4500,
        ledger_consistent: integrity.is_consistent
      }}));
    }})();
    """

    res2 = subprocess.run(['node', '-e', p2_code], capture_output=True, encoding='utf-8', check=True)
    audit = json.loads(res2.stdout.strip())

    print(f"  - Product Persisted    : {audit['product_found']}")
    print(f"  - Payout Persisted     : {audit['payout_found']}")
    print(f"  - Balance Intact       : {audit['balance_intact']}")
    print(f"  - Ledger Consistent    : {audit['ledger_consistent']}")

    if audit['product_found'] and audit['payout_found'] and audit['balance_intact'] and audit['ledger_consistent']:
        print("\nRESULT: SERVER RESTART SAFETY & PERSISTENCE VERIFIED [PASS]")
        sys.exit(0)
    else:
        print("\nRESULT: RESTART PERSISTENCE FAILED [FAIL]")
        sys.exit(1)

if __name__ == '__main__':
    main()
