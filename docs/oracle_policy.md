# KrishiSetu Deterministic Multi-Oracle Dispute Policy (FS-2604)

## 1. Overview
The KrishiSetu oracle subsystem ingests rainfall observations from at least **three independent meteorological sources** with deterministic validation, spatial clustering, and dispute arbitration. No single oracle is trusted unconditionally.

---

## 2. Oracle Hierarchy & Modalities

| Oracle ID | Name | Modality | Default Confidence | Update Interval |
|---|---|---|---|---|
| `AWS_IMD_MANDAL` | IMD Automated Ground Weather Station | Calibrated Ground Sensor | $0.95$ | 60 mins |
| `SATELLITE_GPM_GRID` | NASA GPM / CHIRPS Satellite Grid | Microwave/IR Satellite Grid | $0.90$ | 180 mins |
| `PANCHAYAT_IOT_GUAGE` | Gram Panchayat Community Rain Gauge | Local Micro-IoT Sensor | $0.85$ | 30 mins |

---

## 3. Deterministic Validation Pipeline

Every candidate observation undergoes a 4-step pipeline:

```
[Raw Observation]
       │
       ▼
 1. Freshness Check (age ≤ max_stale_minutes) ──> [If stale: Mark STALE]
       │
       ▼
 2. Physical & Cryptographic Integrity ────────> [If invalid/tampered: Mark INTEGRITY_FAILURE]
       │
       ▼
 3. Spatial Variance Clustering (|Ri - Rj| ≤ 12mm)
       │
       ▼
 4. Quorum Decision (Cluster Size ≥ MinSources)
       ├── Yes: Weighted Aggregation (Median/Confidence Average) ──> CONSENSUS_REACHED
       └── No : Disputed / Quorum Broken ─────────────────────────> DISPUTE_QUORUM_FAILED
```

---

## 4. Scenario Arbitration Rules

### Case A: Single Stale Source
- **Condition:** Source timestamp $(t_{\text{now}} - t_{\text{obs}}) > 180\text{ min}$.
- **Resolution:** Source is marked `STALE` and excluded from the candidate pool. If the remaining $\ge 2$ sources agree, quorum is established and valid payout decision proceeds.

### Case B: Single Unavailable Source
- **Condition:** Sensor is offline, returning `null` or `UNAVAILABLE`.
- **Resolution:** Marked `UNAVAILABLE`. System gracefully falls back to the remaining operational sources without halting.

### Case C: Manipulated / Corrupted Source
- **Condition:** One sensor reports anomalous rainfall (e.g. 0mm when others report 65mm, or failed HMAC signature).
- **Resolution:** Marked `INTEGRITY_FAILURE` or `OUTLIER`. Outlier is disqualified from the consensus cluster. Payout evaluates against the honest cluster. **Zero fraudulent payouts are triggered.**

### Case D: Two-Way Disagreement (Unresolvable Split)
- **Condition:** Operational sources diverge beyond variance limit (e.g., Source A reports 12mm, Source B reports 85mm).
- **Resolution:** The engine declares `DISPUTE_QUORUM_FAILED`. Automatic payout is halted immediately. A machine-readable reason is logged in the audit trail. **The system NEVER silently pays on unverified data.**

---

## 5. Mathematical Aggregation Formula

When consensus is reached across the agreeing cluster $\mathcal{C}$:
$$\text{Aggregated Rainfall} = \frac{\sum_{i \in \mathcal{C}} w_i \cdot R_i}{\sum_{i \in \mathcal{C}} w_i}$$
where $w_i$ is the static confidence weight of source $i$ and $R_i$ is the recorded precipitation in millimeters.
