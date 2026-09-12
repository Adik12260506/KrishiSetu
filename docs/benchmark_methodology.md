# KrishiSetu Benchmark Methodology & Measurement Standards (FS-2604)

## 1. Zero-Fabrication Rule
Every numeric claim presented in documentation, UI, or evaluation reports is backed by a standalone reproducible Python/Node benchmark script.

---

## 2. Benchmark Suite Reference

| Benchmark | Script Path | Measured Target | Official Target | Methodology |
|---|---|---|---|---|
| **Wire Payload Size** | `scripts/measure_payload.py` | **877 Bytes (40 events)** | $< 2048\text{ Bytes}$ | Measures exact binary packed bytes across 1 to 40 events using Python `struct.pack`. |
| **Operating Cost** | `bench/cost_benchmark.py` | **₹0.847 / policy** | $< ₹2.00\text{ / policy}$ | Itemized model across compute, database storage, 2G bandwidth, CDN audio cache, and sensor calibration. |
| **Network Chaos** | `bench/chaos_bench.py` | **100% completion** | 40 kbps, 2s RTT, 3% loss | Simulates 100 transactions over lossy high-latency radio links with random drops. |
| **Global Determinism** | `scripts/test_determinism.py` | **100% SHA256 Match** | Byte-identical output | Executes 2 independent runs of the scored payout path and verifies SHA-256 hash identity. |
| **Sealed Evaluation** | `scripts/test_eval_suite.py` | **14 / 14 Passed** | 100% Passed | Automated test of all 14 official criteria (oracles, offline, security, stale sync, product launch). |
| **Security Suite** | `bench/security_bench.py` | **100% Pass** | Zero Leakage / RBAC | Tests authentication, authorization, duplicate payout prevention, and cross-user isolation. |
