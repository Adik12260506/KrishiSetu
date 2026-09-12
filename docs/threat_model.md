# KrishiSetu Threat Model & Shared Device Security Architecture

## 1. Adversary Model & Assumptions

In rural Indian agrarian contexts, low-connectivity devices operate in high-risk physical and network environments:
1. **Shared Feature Phone Adversary:** Multiple family members or community farmers share a single handset. An unauthorized user may attempt to inspect balances, bind policies, or divert payouts.
2. **Network Intermediary / 2G Man-in-the-Middle:** Unreliable 2G base stations or rogue towers dropping packets, injecting duplicate sync payloads, or replaying historical events.
3. **Corrupted / Compromised Local Weather Sensor:** Malicious actors attempting to trigger fraudulent payouts by spoofing zero-rainfall readings.
4. **Client Clock Drift / Manipulation:** A farmer manually changing the system clock forward by 30 days to claim an expired window.

---

## 2. Trust Boundaries & Security Enforcements

```
+-----------------------------------------------------------------------+
| UNTRUSTED ENVIRONMENT                                                 |
| - Feature phone physical storage (shared)                             |
| - Client wall-clock timestamps (untrusted)                            |
| - Network radio link (subject to drops / replays)                     |
+-----------------------------------------------------------------------+
                                   │
                     [Cryptographic Session Token]
                     [Monotonic Sequence Number]
                                   │
                                   ▼
+-----------------------------------------------------------------------+
| TRUSTED CORE / BACKEND BOUNDARY                                       |
| - Role-Based Access Control (FARMER vs ADMIN vs JUROR)                |
| - Unique Idempotency Key Filter (Deduplication)                       |
| - Server-Side Monotonic Ledger (Verified Balances)                    |
| - Multi-Oracle Quorum Engine (Anti-Poisoning)                         |
| - MongoDB Persistent Storage (Encrypted at Rest)                      |
+-----------------------------------------------------------------------+
```

---

## 3. Threat Mitigations

| Threat | Attack Vector | Architectural Mitigation |
|---|---|---|
| **Cross-User Data Leakage** | User B picks up phone after User A | Bearer session tokens, cryptographic storage namespaces (`SHA256(user_id)`), active session memory zeroing on logout. Zero global user state on server. |
| **Duplicate Payout Attack** | Replaying sync request after network drops | Idempotency keys indexed uniquely in MongoDB (`event_id` and `payout_id`). Replayed events return cached acknowledgment without double-crediting. |
| **Clock Manipulation** | Advancing phone date 30 days | Zero trust in client wall-clock timestamps. Server anchors observation epochs using monotonic client sequence counters ($S_{\text{client}}$). |
| **Oracle Sensor Spoofing** | Hacking 1 ground weather station | Quorum engine requires at least 2 independent agreeing modalities with pairwise variance $\le 12\text{mm}$. Outliers are rejected. |
| **Privilege Escalation** | Farmer calling `POST /api/products` | Strict RBAC middleware (`requireRole(['ADMIN', 'JUROR'])`). Farmer role receives `403 FORBIDDEN`. |
