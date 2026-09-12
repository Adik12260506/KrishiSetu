# KrishiSetu (FS-2604) System Architecture

```
                      FARMER
                         │
                         ▼
               ┌──────────────────┐
               │  PWA / Web App   │
               │  Local-First UI  │
               └────────┬─────────┘
                        │
               ┌────────▼─────────┐
               │  Policy Engine   │
               │  JSON Rules      │
               └────────┬─────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Weather A      Weather B      Weather C
          │             │             │
          └─────────────┼─────────────┘
                        ▼
               ┌─────────────────┐
               │ Consensus Engine│
               │ Median + Freshness
               │ + Outlier Rules │
               └────────┬────────┘
                        ▼
               ┌─────────────────┐
               │ Payout Decision │
               └────────┬────────┘
                        ▼
               ┌─────────────────┐
               │ Offline Wallet  │
               │ Local Storage   │
               └────────┬────────┘
                        │
                  Network restored
                        │
                        ▼
               ┌─────────────────┐
               │ Sync + Audit Log│
               └─────────────────┘
```

## Component Breakdown & Data Flow

1. **Farmer Interaction (PWA / Web App Local-First UI)**
   - Voice-first onboarding with regional Indian language prompts (Hindi, Telugu, English).
   - Mandatory comprehension quiz verification before policy binding.
   - Operates with zero network connectivity using cached local assets.

2. **Policy Engine (JSON Rules)**
   - Declarative policy definitions (`monsoon-drought-groundnut-v1`, `kharif-paddy-deficit-v1`).
   - Pure functional payout curve evaluator: Linear Pro-Rata, Step Threshold, Multi-Tier Drought, Excess Rain.
   - Non-engineers can launch new products without application restart or code deployment.

3. **Multi-Weather Oracles (Weather A, B, C)**
   - **Weather A:** IMD Ground Automated Weather Station (AWS).
   - **Weather B:** NASA GPM / CHIRPS Gridded Satellite precipitation feed.
   - **Weather C:** Gram Panchayat Digital IoT Rain Gauge.

4. **Consensus Engine (Median + Freshness + Outlier Rules)**
   - **Freshness Filter:** Reject observations older than max allowed age (180 minutes).
   - **Physical Bounds:** Reject impossible rainfall values ($<0\text{mm}$ or $>1000\text{mm}$).
   - **Pairwise Variance Clustering & Median Aggregation:** Agreeing cluster within variance threshold ($\le 12\text{mm}$) forms quorum. Outliers and manipulated sensors are safely rejected.
   - **Dispute Policy:** If no quorum is formed, triggers `DISPUTE_QUORUM_FAILED` to prevent blind payouts.

5. **Payout Decision Engine**
   - Deterministic loss evaluation based on validated rainfall vs. policy threshold.
   - Evaluates in $< 2.5\text{ milliseconds}$.
   - Generates immutable cryptographic Decision ID and step-by-step reconstruction trail.

6. **Offline Wallet (Local Storage)**
   - Local state machine maintaining spendable balance and monotonic sequence counter ($S_{\text{client}}$).
   - Authorizes immediate local spends at agri-input merchants for certified seeds/fertilizer with zero data connection.
   - Strict cryptographic user session boundaries prevent cross-user leakage on shared feature phones.

7. **Sync + Audit Log (When Network is Restored)**
   - Encodes queued offline events into purpose-built compact binary/hex wire format ($< 2\text{ KB}$).
   - Idempotent deduplication prevents double-crediting.
   - Reconciles multi-day stale devices without server state corruption.
   - Produces full Juror Reconstruction DAG.
