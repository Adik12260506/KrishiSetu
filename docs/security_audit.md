# FS-2604 Security & Resilience Audit Report

**System:** KrishiSetu (FS-2604: Offline-First Parametric Micro-Insurance)  
**Audit Date:** 2026-09-12  
**Evaluation Target:** Hackathon Evaluation & Production Hardening  

---

## 1. Executive Summary

This audit evaluates the baseline implementation of KrishiSetu against the non-negotiable evaluation constraints of **FS-2604**. The core algorithmic engine (deterministic formula evaluation, compact wire codec, multi-oracle consensus) is structurally sound and mathematically deterministic. However, the server-side session model, role enforcement, and persistence layer required hardening to eliminate shared in-memory singletons and prevent unauthorized cross-user access.

---

## 2. Identified Vulnerabilities & Hardening Matrix

| ID | Component | Vulnerability / Weakness | Severity | Impact | Recommended Fix | Affected Files | Scored Path Impact |
|---|---|---|---|---|---|---|---|
| **SEC-01** | `core/wallet/session_manager.js` | **Server-side singleton session state.** The server tracked `activeUser` as a single variable in memory. If User A and User B connected simultaneously, their sessions collided. | **CRITICAL** | Cross-tenant session collision | Implement cryptographic bearer session tokens stored in MongoDB with device binding and expiration. | `backend/routes.js`, `core/wallet/session_manager.js`, `backend/models.js` | Improves security without altering deterministic formula math. |
| **SEC-02** | `backend/routes.js` | **Missing RBAC on administrative endpoints.** `POST /api/products` and `POST /api/oracles/override` lacked role authorization checks. | **HIGH** | Unauthorized product creation or chaos injection | Implement Role-Based Access Control (`FARMER`, `ADMIN`, `JUROR`). Restrict policy creation and oracle manipulation to `ADMIN`/`JUROR`. | `backend/routes.js`, `backend/auth_middleware.js` | None. |
| **SEC-03** | `backend/db.js`, `backend/models.js` | **Missing Database Unique Constraints.** Idempotency relied primarily on in-memory `Set` rather than database unique indexes. | **HIGH** | Potential double-credit on server restart | Add unique indexes on `sync_events.event_id`, `payouts.payout_id`, `payouts.decision_id`, `sessions.token`. | `backend/db.js`, `backend/models.js` | Guarantees strict idempotency across restarts. |
| **SEC-04** | `core/sync/conflict_resolver.js` | **In-memory event ledger not fully synchronized with MongoDB.** Server reconciler kept an in-memory `appliedEvents` set. | **HIGH** | Stale reconciliation after server restart | Back reconciler state directly with MongoDB `sync_events` collection. | `core/sync/conflict_resolver.js`, `backend/models.js` | Ensures 9-day stale reconciliation survives restarts. |
| **SEC-05** | `core/oracle/aggregation_engine.js` | **Oracle statuses needed explicit taxonomy.** Outliers were occasionally grouped with manipulated feeds. | **MEDIUM** | Ambiguous juror audit trail | Standardize explicit taxonomy: `HEALTHY`, `STALE`, `UNAVAILABLE`, `OUTLIER`, `INTEGRITY_FAILURE`, `DISPUTED`. | `core/oracle/oracle_types.js`, `core/oracle/aggregation_engine.js` | Produces clearer reconstruction audit DAG. |
| **SEC-06** | `server.js` | **Missing HTTP Security Headers & Rate Limiting.** No protection against rapid brute-force or clickjacking. | **MEDIUM** | Denial-of-service / brute-force risk | Add security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`) and in-memory token-bucket rate limiter. | `server.js` | None. |
| **SEC-07** | Repository Root | **Missing `.env.example` & configuration templates.** | **LOW** | Potential accidental configuration leaks | Create `.env.example` with documented environment variables (`MONGODB_URI`, `PORT`, `SESSION_SECRET`). | `.env.example`, `.gitignore` | None. |

---

## 3. Detailed Component Analysis

### 3.1 Backend & Session Architecture
- **Current State:** The backend used a shared `globalSessionManager` singleton.
- **Remediation:** Introduce stateless Bearer token authentication (`KS_SESS_<random_hex>`). Each session is stored in MongoDB with `user_id`, `device_id`, `role`, `created_at`, `expires_at`.

### 3.2 MongoDB as Persistent Source of Truth
- **Current State:** Product definitions and payouts were saved to MongoDB but also cached in memory maps.
- **Remediation:** Database operations are made primary. On startup, collections are indexed and seeded. Restart safety tests verify that payouts and policies persist seamlessly across process kills.

### 3.3 Wallet as Event Ledger
- **Current State:** Balances were stored as scalar floats with append-only logs.
- **Remediation:** Implement deterministic ledger reduction validation ($Balance = \sum Credits - \sum Spends$) with integrity checks to guarantee zero balance corruption.

### 3.4 Multi-Oracle & Dispute Taxonomy
- **Current State:** 3 independent sources with spatial variance clustering.
- **Remediation:** Formalize explicit state transitions: `HEALTHY`, `STALE`, `UNAVAILABLE`, `OUTLIER`, `INTEGRITY_FAILURE`, `DISPUTED`. Ensure `DISPUTE_QUORUM_FAILED` produces an immutable audit record.

---

## 4. Hardening Roadmap

1. **Phase 1 & 2:** MongoDB schema, collections, unique indexing, and restart verification.
2. **Phase 3 & 4:** Token-based Authentication, RBAC (`FARMER`, `ADMIN`, `JUROR`), and strict device/user isolation.
3. **Phase 5 & 6:** Cryptographic event signatures and client-side storage isolation.
4. **Phase 7 & 8:** Database-backed idempotent sync and ledger event reduction.
5. **Phase 9:** Payout state machine with double-credit protection.
6. **Phase 10 & 11:** Formalized oracle states and `docs/oracle_policy.md`.
7. **Phase 12–15:** Policy schema immutability, safe DSL verification, API security middleware & rate limiting.
8. **Phase 16–27:** Secrets externalization, healthz probe, metrics, and security documentation.
9. **Phase 28–30:** Comprehensive security test suite (`scripts/test_security_suite.py`) and performance benchmarks.
