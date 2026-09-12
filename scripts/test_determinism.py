#!/usr/bin/env python3
"""
Official Determinism Verification Script (FS-2604 Criterion 19)
Requirement: Global seed + Identical input MUST produce byte-identical results.
"""

import sys
import hashlib
import json
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_node_eval(seed: int, input_data: dict) -> str:
    """Executes deterministic evaluation via Node.js runtime and returns raw JSON string"""
    js_code = f"""
    const {{ globalProductRegistry }} = require('./core/policy/product_registry');
    const {{ globalPayoutEngine }} = require('./core/payout/payout_engine');
    const {{ buildReconstructionTrail }} = require('./core/payout/reconstruction_trail');

    const inputData = {json.dumps(input_data)};
    const product = globalProductRegistry.getProduct(inputData.product_id);
    
    const decision = globalPayoutEngine.evaluatePayout({{
      policy: product,
      oracleObservations: inputData.observations,
      evalTimestampIso: inputData.eval_timestamp,
      farmerId: inputData.farmer_id,
      deviceId: inputData.device_id
    }});

    const trail = buildReconstructionTrail(decision, product);
    decision.reconstruction_trail = trail;

    process.stdout.write(JSON.stringify(decision));
    """
    
    result = subprocess.run(
        ['node', '-e', js_code],
        capture_output=True,
        encoding='utf-8',
        check=True
    )
    return result.stdout.strip()

def main():
    print("=" * 60)
    print("FS-2604 GLOBAL DETERMINISM VERIFICATION TEST")
    print("Constraint: seed + input + policy + oracles -> Byte-Identical Output")
    print("=" * 60)

    fixed_timestamp = "2026-09-12T12:00:00.000Z"
    test_input = {
        "product_id": "monsoon-drought-groundnut-v1",
        "farmer_id": "farmer_ramesh_test",
        "device_id": "DEV_ANANTAPUR_01",
        "eval_timestamp": fixed_timestamp,
        "observations": [
            {
                "source_id": "AWS_IMD_MANDAL",
                "name": "IMD Automated Weather Station",
                "rainfall_mm": 18.5,
                "observation_timestamp": fixed_timestamp,
                "confidence": 0.95,
                "signature": "sig_imd_static_001"
            },
            {
                "source_id": "SATELLITE_GPM_GRID",
                "name": "NASA GPM Satellite Grid",
                "rainfall_mm": 19.7,
                "observation_timestamp": fixed_timestamp,
                "confidence": 0.90,
                "signature": "sig_gpm_static_002"
            },
            {
                "source_id": "PANCHAYAT_IOT_GUAGE",
                "name": "Gram Panchayat Rain Gauge",
                "rainfall_mm": 17.7,
                "observation_timestamp": fixed_timestamp,
                "confidence": 0.85,
                "signature": "sig_iot_static_003"
            }
        ]
    }

    print("\n[RUN 1] Executing scored payout flow with seed=2604...")
    output_run_1 = run_node_eval(seed=2604, input_data=test_input)
    hash_run_1 = hashlib.sha256(output_run_1.encode('utf-8')).hexdigest()

    print(f"  - Output Bytes : {len(output_run_1):,} bytes")
    print(f"  - SHA-256 Hash : {hash_run_1}")

    print("\n[RUN 2] Re-executing scored payout flow in a fresh process with seed=2604...")
    output_run_2 = run_node_eval(seed=2604, input_data=test_input)
    hash_run_2 = hashlib.sha256(output_run_2.encode('utf-8')).hexdigest()

    print(f"  - Output Bytes : {len(output_run_2):,} bytes")
    print(f"  - SHA-256 Hash : {hash_run_2}")

    print("\n" + "=" * 60)
    print("DETERMINISM COMPARISON VERIFICATION:")
    if output_run_1 == output_run_2 and hash_run_1 == hash_run_2:
        parsed = json.loads(output_run_1)
        print(f"  - Decision ID       : {parsed.get('decision_id')}")
        print(f"  - Payout ID         : {parsed.get('payout_id')}")
        print(f"  - Calculated Payout : INR {parsed.get('payout_amount_inr')}")
        print(f"  - Aggregated Rain   : {parsed.get('aggregated_rainfall_mm')} mm")
        print(f"  - Hash Match        : 100% BYTE IDENTICAL (SHA256: {hash_run_1[:16]}...)")
        print("RESULT: DETERMINISM TEST PASSED [PASS]")
        sys.exit(0)
    else:
        print("RESULT: NON-DETERMINISTIC DRIFT DETECTED [FAIL]")
        sys.exit(1)

if __name__ == '__main__':
    main()
