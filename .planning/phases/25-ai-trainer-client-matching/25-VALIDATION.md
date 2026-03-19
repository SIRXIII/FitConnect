---
phase: 25
slug: ai-trainer-client-matching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vite.config.ts` (vitest inline config) |
| **Quick run command** | `npx vitest run src/lib/matchScoring.test.ts` |
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
| `src/lib/matchScoring.test.ts` | computeMatchScore (price 60pts + goals 40pts), buildExplanations, isPassportReady gate, tier labels | AIMATCH-01, AIMATCH-02, AIMATCH-03 |

---

## Wave 0 Gaps (from RESEARCH.md)

- `src/lib/matchScoring.test.ts` — Plan 25-01 Task 1 creates this (TDD RED then GREEN)
