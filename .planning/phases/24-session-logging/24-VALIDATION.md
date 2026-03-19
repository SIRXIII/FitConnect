---
phase: 24
slug: session-logging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vite.config.ts` (vitest inline config) |
| **Quick run command** | `npx vitest run src/lib/sessionAggregation.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After Wave 2 complete:** Run full suite

---

## Wave 0 Test Map

| Test File | Covers | Requirements |
|-----------|--------|-------------|
| `src/components/session/SessionLogPanel.test.tsx` | 24hr lock logic, exercise add/remove, auto-save mock | SESSION-01, SESSION-03 |
| `src/lib/sessionAggregation.test.ts` | Weekly aggregation of sessions and total sets | SESSION-04 |
| `src/components/client/ProgressTab.test.tsx` | Empty state render, timeline list with mock data | SESSION-04 |

---

## Wave 0 Gaps (from RESEARCH.md)

- `src/components/session/SessionLogPanel.test.tsx` — new file
- `src/lib/sessionAggregation.test.ts` — new file (Plan 24-03 Task 1 creates this)
- `src/components/client/ProgressTab.test.tsx` — new file
