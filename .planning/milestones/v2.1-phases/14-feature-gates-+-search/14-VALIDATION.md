---
phase: 14
slug: feature-gates-+-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (inferred from Vite project) |
| **Config file** | None found — Wave 0 must add test config block to `vite.config.ts` or create `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | < 10 seconds (unit tests only) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --reporter=verbose` (unit tests, < 10s)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + manual smoke of `get_visible_slots` RPC via Supabase Studio before `/gsd:verify-work`

---

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIER-01 | Free trainer sees exactly 3 slots via `get_visible_slots` | smoke (Supabase RPC integration) | manual-only — requires live DB | N/A |
| TIER-02 | Pro trainer sees exactly 10 slots via RPC | smoke | manual-only | N/A |
| TIER-03 | Elite trainer sees all slots | smoke | manual-only | N/A |
| TIER-04 | Bio > 280 chars returns 400 for Free trainer | unit | `npx vitest run src/lib/tierGates.test.ts` | ❌ Wave 0 |
| TIER-05 | Analytics tab absent from Free trainer render | unit | `npx vitest run src/hooks/useTier.test.ts` | ❌ Wave 0 |
| TIER-06 | Downgrade does not mutate slots or bio in DB | manual-only — DB state verification | manual | N/A |
| SRCH-01 | Elite/Pro trainers sort before Free in `rankTrainers` output | unit | `npx vitest run src/hooks/useTrainers.test.ts` | ❌ Wave 0 |
| SRCH-02 | FeaturedTrainers renders when Elite trainers exist | unit | `npx vitest run src/components/landing/FeaturedTrainers.test.tsx` | ❌ Wave 0 |
| SRCH-03 | FeaturedTrainers returns null when no Elite trainers | unit | same file | ❌ Wave 0 |

---

## Wave 0 Gaps (files that must exist before validation can run)

- [ ] `src/lib/tierGates.test.ts` — covers TIER-04 (bio limit validation), `useCan` logic
- [ ] `src/hooks/useTier.test.ts` — covers TIER-05 (`useCan('analytics_advanced')` returns false for free)
- [ ] `src/hooks/useTrainers.test.ts` — covers SRCH-01 (`rankTrainers` with tier signal)
- [ ] `src/components/landing/FeaturedTrainers.test.tsx` — covers SRCH-02, SRCH-03
- [ ] Vitest config (in `vite.config.ts` or standalone `vitest.config.ts`)
