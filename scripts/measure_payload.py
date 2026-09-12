#!/usr/bin/env python3
"""
Official Sync Payload Measurement Script (FS-2604 Acceptance Criterion B)
Requirement: Every individual sync payload MUST be < 2048 bytes (< 2 KB).
"""

import sys
import struct
import zlib
import json

def hash_string_32(s: str) -> int:
    h = 0
    for char in s:
        h = ((h << 5) - h + ord(char)) & 0xFFFFFFFF
    return h

def encode_compact_sync_payload(device_id: str, farmer_id: str, client_seq: int, events: list) -> bytes:
    """
    Encodes wallet events into the KrishiSetu Compact Wire Format
    Header: 37 bytes
    Each Event: 25 bytes
    """
    event_count = len(events)
    header_magic = b'KS' # 2 bytes
    version = 1          # 1 byte
    
    # 16-byte fixed device id
    dev_id_bytes = device_id.encode('utf-8')[:16].ljust(16, b'\x00')
    
    user_hash = hash_string_32(farmer_id)
    ts = 1789214400 # deterministic timestamp
    header_checksum = (user_hash ^ client_seq ^ ts) & 0xFFFFFFFF
    
    header = struct.pack(
        '>2sB16sIIIHI',
        header_magic,
        version,
        dev_id_bytes,
        user_hash,
        client_seq,
        ts,
        event_count,
        header_checksum
    )
    
    type_map = {'POLICY_BIND': 1, 'PAYOUT_CREDIT': 2, 'OFFLINE_SPEND': 3, 'SYNC_ACK': 4}
    
    event_bytes = bytearray()
    for evt in events:
        type_code = type_map.get(evt.get('event_type', 'OFFLINE_SPEND'), 3)
        evt_id_hash = hash_string_32(evt.get('event_id', ''))
        target_hash = hash_string_32(evt.get('target_id', ''))
        amount_paise = int(evt.get('amount_inr', 0) * 100)
        seq = evt.get('sequence', 1)
        evt_ts = ts
        
        packed_evt = struct.pack(
            '>BIIIiI',
            type_code,
            evt_id_hash,
            target_hash,
            seq,
            amount_paise,
            evt_ts
        )
        event_bytes.extend(packed_evt)
        
    return header + bytes(event_bytes)

def main():
    print("=" * 60)
    print("FS-2604 SYNC PAYLOAD WIRE FORMAT MEASUREMENT BENCHMARK")
    print("Constraint: Any Single Sync Payload MUST be < 2048 bytes (2 KB)")
    print("=" * 60)
    
    test_batches = [
        ("Single Policy Bind", [
            {"event_type": "POLICY_BIND", "event_id": "EVT_01", "target_id": "monsoon-drought-groundnut-v1", "amount_inr": 0, "sequence": 1}
        ]),
        ("Drought Payout Credit", [
            {"event_type": "PAYOUT_CREDIT", "event_id": "EVT_02", "target_id": "PAY_98213", "amount_inr": 4500.0, "sequence": 2}
        ]),
        ("5 Typical Offline Spends Batch", [
            {"event_type": "OFFLINE_SPEND", "event_id": f"EVT_SPEND_{i}", "target_id": f"MERCHANT_{i}", "amount_inr": 350.0 + i * 50, "sequence": 3 + i}
            for i in range(5)
        ]),
        ("15 Extreme Multi-Event Sync Batch", [
            {"event_type": "OFFLINE_SPEND", "event_id": f"EVT_EXT_{i}", "target_id": f"MERCHANT_{i}", "amount_inr": 120.0, "sequence": i + 1}
            for i in range(15)
        ]),
        ("40 Heavy 9-Day Stale Sync Queue Batch", [
            {"event_type": "OFFLINE_SPEND", "event_id": f"EVT_STALE_{i}", "target_id": f"MERCHANT_{i}", "amount_inr": 75.0, "sequence": i + 1}
            for i in range(40)
        ])
    ]
    
    all_pass = True
    max_observed_size = 0
    
    for batch_name, events in test_batches:
        raw_wire_bytes = encode_compact_sync_payload("DEV_ANANTAPUR_01", "farmer_ramesh_001", len(events), events)
        compressed_bytes = zlib.compress(raw_wire_bytes)
        
        raw_size = len(raw_wire_bytes)
        comp_size = len(compressed_bytes)
        max_observed_size = max(max_observed_size, raw_size)
        
        # Check standard JSON size for comparison
        json_size = len(json.dumps(events).encode('utf-8'))
        
        is_pass = raw_size < 2048
        if not is_pass:
            all_pass = False
            
        status = "PASS [OK]" if is_pass else "FAIL [EXCEEDED]"
        
        print(f"\nScenario: {batch_name}")
        print(f"  - Number of Events      : {len(events)}")
        print(f"  - Standard JSON Size    : {json_size:,} bytes")
        print(f"  - Compact Wire Raw Size : {raw_size:,} bytes  (Savings: {((json_size - raw_size)/json_size)*100:.1f}%)")
        print(f"  - Zlib Compressed Size  : {comp_size:,} bytes")
        print(f"  - Status vs 2048B Limit : {status}")
        
    print("\n" + "=" * 60)
    print(f"SUMMARY: Maximum Payload Size Observed = {max_observed_size:,} bytes / 2048 bytes Limit")
    print(f"Headroom Margin: {2048 - max_observed_size:,} bytes ({( (2048 - max_observed_size) / 2048 ) * 100:.1f}% safety margin)")
    if all_pass:
        print("RESULT: ALL SYNC PAYLOADS STRICTLY COMPLY WITH < 2 KB CONSTRAINT [PASS]")
        sys.exit(0)
    else:
        print("RESULT: PAYLOAD LIMIT EXCEEDED [FAIL]")
        sys.exit(1)

if __name__ == '__main__':
    main()
