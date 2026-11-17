# STRIDE — Product Requirements Document v3.0

Existing Features & Advanced Intelligence Roadmap

**Version:** 3.0  
**Date:** 17 November 2026  
**Status:** Current-state baseline + next development roadmap  
**Product:** STRIDE — Personal Fitness Intelligence Platform  
**Primary integration:** Garmin Personal API  
**Primary device:** Garmin Forerunner 165  
**User model:** Single-owner / personal use

> Canonical copy of the v3.0 PRD as provided by the product owner.
> Full body: baseline inventory (§3), gaps (§4), P0–P3 features (§5),
> IA/UX (§7–8), architecture (§9–11), roadmap phases A–K (§13),
> testing/risks/DoD (§14–18), appendices A–C.

## Phase A audit snapshot (17 Nov 2026, local DB)

| Check | Result |
|-------|--------|
| Running activities | 4 synced; 100% avg HR; 75% GPS start |
| HR samples / laps | **0** — zone-time & decoupling blocked |
| `daily_metrics` | **0 rows** despite health sync `success` + fetched 0 |
| Endpoint probes | activities/sleep/hrv/vo2/daily summaries report available |
| Implication | Probe ≠ populated data; Data Quality Center required before P0 analytics |

## Immediate sequence (from §13.1)

1. Audit current database and sync payloads.
2. Build Data Quality & Coverage Center.
3. Verify HR samples and HR-zone summary availability.
4. HR Zone Intelligence (supported data only).
5. Aerobic Efficiency Analyzer.
6. Training load after zone coverage validation.
7. Intraday wellness series.
8. FIT integration only after endpoint/terms proof.

## Priority focus this cycle

| Priority | Feature |
|----------|---------|
| P0 | Data Quality & Coverage Center |
| P0 | HR Zone Intelligence |
| P0 | Aerobic Efficiency Analyzer |
| P1 | Advanced Training Load |
| P1 | Aerobic Decoupling / HR Drift |
| P1/P2 | Energy & Stress Timeline |
| P2 | FIT File Intelligence |
| P2 | Multi-Sport Intelligence |
| P2 | Daily Movement Intelligence |
| P3 | Additional wellness extensions |
