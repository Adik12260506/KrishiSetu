# AI Assistance Ledger (AI_LEDGER.md)

This ledger documents the AI models and tools utilized during the development of KrishiSetu (FS-2604), the prompts asked, and the manual review and verification performed by the engineering team.

---

### 1. Multi-Oracle Aggregation & Dispute Engine (`core/oracle/`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Design a deterministic multi-source rainfall consensus and dispute resolution algorithm incorporating freshness windows, physical validity bounds, pairwise spatial variance clustering, and quorum requirements across at least 3 independent feeds.
- **Changed / Reviewed:** Replaced naive averaging with a strict multi-stage pipeline: (1) Freshness & signature check, (2) Outlier & manipulation rejection, (3) Pairwise variance clustering with quorum $\ge 2$, (4) Halting automatic payout on 2-way splits (`DISPUTE_QUORUM_FAILED`). Added unit tests for manipulated station rejection and 8-hour stale feed handling.

---

### 2. Compact Wire Codec (`core/sync/wire_codec.js` & `scripts/measure_payload.py`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Design an ultra-compact binary and hex wire format for 2G synchronization that packs monotonic sequence numbers, user hashes, event types, paise amounts, and checksums into $< 2048$ bytes.
- **Changed / Reviewed:** Created a fixed 37-byte header + 25-byte per event layout. Added 32-bit checksums and fixed-point paise encoding. Measured payload sizes across 1 to 40 events: observed 58 to 877 bytes, guaranteeing $> 57\%$ headroom under the 2 KB constraint.

---

### 3. Declarative Policy Engine (`core/policy/`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Implement a declarative JSON schema and dynamic mathematical formula evaluator supporting Linear Pro-Rata, Step Threshold, Multi-Tier Drought, and Excess Rain models without requiring code deployment or server restart.
- **Changed / Reviewed:** Ensured pure functional evaluation with zero side effects. Implemented `ProductRegistry` with runtime REST endpoints allowing non-engineers to launch products on the fly.

---

### 4. Offline Wallet & Shared-Device Security (`core/wallet/`, `core/security/`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Create an offline-first state machine with monotonic client sequence counters and cryptographically isolated user storage partitions for shared feature phones.
- **Changed / Reviewed:** Built strict memory zeroing on session termination. Developed `verifyCrossUserIsolation` test ensuring User B cannot read User A's balances, events, or policies under any sequence of logouts or handset handovers.

---

### 5. Payout Reconstruction Trail (`core/payout/reconstruction_trail.js`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Create an explainable audit DAG generator providing step-by-step cryptographic audit nodes for Jurors and plain-language regional summaries (Hindi, Telugu, English) for smallholder farmers.
- **Changed / Reviewed:** Structured DAG nodes covering Policy -> Oracle Ingestion -> Quorum & Dispute -> Formula Math -> Offline Credit.

---

### 6. Voice Accessibility & Comprehension Engine (`core/voice/`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Build an interactive voice onboarding flow in regional Indian languages with spoken disclosures and mandatory comprehension verification before policy binding.
- **Changed / Reviewed:** Created multi-lingual question bank with voice keyword and keypad fallbacks (`1: Yes`, `2: No`). Blocked policy binding until comprehension check passes.

---

### 7. Sealed Evaluation & Chaos Test Suite (`scripts/test_eval_suite.py`, `bench/chaos_bench.py`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Generate automated tests matching all 14 official sealed evaluation criteria and a 40kbps / 2s RTT / 3% packet loss chaos benchmark.
- **Changed / Reviewed:** Verified 100% pass rate across all 14 tests, byte-identical determinism verification, and zero cross-user leakage.

---

### 8. MongoDB Document Persistence Layer (`backend/db.js`, `backend/models.js`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Build MongoDB persistence for product policies, farmer ledgers, evaluated payouts, and sync audit logs with resilient local document adapter fallback.
- **Changed / Reviewed:** Implemented standard `mongodb` driver connection supporting `MONGODB_URI` environment variable with auto-fallback to persistent local document storage, preserving instant 3-command run capability with zero required daemon setup.

---

### 9. Security, RBAC & Resilience Hardening Pass (`backend/auth_middleware.js`, `bench/security_bench.py`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Implement Bearer session token authentication, Role-Based Access Control (`FARMER`, `ADMIN`, `JUROR`), unique database constraints for idempotent payouts and sync events, wallet ledger balance reduction verification, rate limiting, and automated security benchmark suite.
- **Changed / Reviewed:** Replaced server-side singleton state with stateless Bearer tokens persisted to MongoDB; added unique indexes preventing duplicate credits; implemented deterministic event reduction validation; verified zero cross-user leakage across shared device handovers.

---

### 10. Multi-Lingual Odia Expansion & Voice Query Assistant (`core/voice/`, `frontend/app.js`, `frontend/index.html`)
- **Model/Tool Used:** Antigravity AI Assistant (Gemini 3.7 Flash)
- **Asked:** Expand regional Indian language support to include Odia (`or-IN`) across voice prompts, comprehension quizzes, and build an interactive voice and text Query Assistant on the farmer portal.
- **Changed / Reviewed:** Added full Odia translations, comprehension question bank with Odia keywords (`ho`, `han`, `hote`, `bhul`), Web Speech API recognition and synthesis for `or-IN`, quick query suggestion chips, and an audio-enabled answer playback card.


