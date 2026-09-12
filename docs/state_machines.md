# KrishiSetu State Machines & Deterministic Transitions

## 1. Payout Settlement Lifecycle State Machine

```
               [TRIGGER DETECTED]
                       │
                       ▼
             ┌───────────────────┐
             │    EVALUATING     │
             └─────────┬─────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[Quorum Reached]              [Quorum Failed]
       │                               │
       ▼                               ▼
┌──────────────┐             ┌───────────────────┐
│   VERIFIED   │             │ DISPUTE_SUSPENDED │
└──────┬───────┘             └───────────────────┘
       │
       ▼
┌──────────────┐
│  AUTHORIZED  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   CREDITED   │ ───> [Spendable Offline Immediately]
└──────┬───────┘
       │
 [Network Online]
       │
       ▼
┌──────────────┐
│    SYNCED    │ ───> [Idempotently Sealed in MongoDB Ledger]
└──────────────┘
```

---

## 2. Shared-Device Session State Machine

```
              [NO ACTIVE SESSION]
                       │
             User A Authenticates (PIN)
                       │
                       ▼
             ┌───────────────────┐
             │   USER A ACTIVE   │ ───> Scoped Local Partitions
             └─────────┬─────────┘
                       │
             Logout / Session Timeout
                       │
                       ▼
             ┌───────────────────┐
             │   MEMORY ZEROED   │ ───> All references cleared
             └─────────┬─────────┘
                       │
             User B Authenticates (PIN)
                       │
                       ▼
             ┌───────────────────┐
             │   USER B ACTIVE   │ ───> ZERO Cross-User Data Access
             └───────────────────┘
```
