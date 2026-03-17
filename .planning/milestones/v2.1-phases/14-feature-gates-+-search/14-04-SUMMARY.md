---
phase: 14-feature-gates-+-search
plan: "04"
subsystem: ui
tags: [vitest, react, typescript, search-ranking, tier-signal, featured-trainers]

# Dependency graph
requires:
  - phase: 14-feature-gates-+-search
    plan: "01"
    provides: subscription_tier on TrainerWithProfile via TrainerProfile type
provides:
  - rankTrainers with tier signal (elite=1.0, pro=0.67, free=0.0 at weight 0.20)
  - FeaturedTrainers component — self-hiding Elite trainer section
  - FeaturedTrainers inserted above BestDeals in Landing.tsx
affects:
  - 15-subscription-ui (tier badges visible to elite trainers on their featured cards)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - tierScore IIFE inline in rankTrainers .map() — no external helper needed
    - Self-hiding component pattern: null state (loading) returns null; empty array (no data) returns null
    - Supabase chain in useEffect with .then() — no try/catch needed for non-critical UI fetch

key-files:
  created:
    - "Cenlar demand gt 1-17/src/hooks/useTrainers.test.ts"
    - "Cenlar demand gt 1-17/src/components/landing/FeaturedTrainers.tsx"
    - "Cenlar demand gt 1-17/src/components/landing/FeaturedTrainers.test.tsx"
  modified:
    - "Cenlar demand gt 1-17/src/hooks/useTrainers.ts"
    - "Cenlar demand gt 1-17/src/pages/Landing.tsx"

key-decisions:
  - "tierScore IIFE (elite=1.0, pro=0.67, free=0.0) injected at weight 0.20 into rankTrainers — new weights: 0.35/0.20/0.15/0.10/0.20"
  - "FeaturedTrainers uses null vs [] distinction for loading vs empty — single return null covers both (SRCH-03)"
  - "No conditional wrapping in Landing.tsx — FeaturedTrainers self-hides, matches ReferralLeaderboard pattern already in project"

requirements-completed:
  - SRCH-01
  - SRCH-02
  - SRCH-03

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 14 Plan 04: Tier-Aware Ranking + Featured Trainers Summary

**Tier priority signal injected into rankTrainers (elite>pro>free) and self-hiding FeaturedTrainers section added to Landing.tsx above BestDeals — 20 tests GREEN (15 prior + 3 ranking + 2 component)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-16T21:50:46Z
- **Completed:** 2026-03-16T21:54:00Z
- **Tasks:** 2 (TDD: RED then GREEN each)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- rankTrainers updated with tierScore IIFE: elite=1.0, pro=0.67, free=0.0 at weight 0.20
- New ranking formula weights: discount 35%, rating 20%, proximity 15%, availability 10%, tier 20%
- 3 unit tests confirm elite > pro > free ordering when all other signals equal
- FeaturedTrainers.tsx — fetches elite+verified trainers, returns null when null (loading) or empty (SRCH-03)
- FeaturedTrainers placed above BestDeals in Landing.tsx (SRCH-02 placement)
- Full suite: 20 tests GREEN across 4 test files

## Task Commits

1. **Task 1: Add tier signal to rankTrainers + tests** — `04dd145` (feat)
2. **Task 2: FeaturedTrainers component + Landing.tsx** — `b5b5caf` (feat)

## Files Created/Modified

- `Cenlar demand gt 1-17/src/hooks/useTrainers.ts` — tierScore IIFE injected, new weight formula
- `Cenlar demand gt 1-17/src/hooks/useTrainers.test.ts` — 3 tier-ranking unit tests
- `Cenlar demand gt 1-17/src/components/landing/FeaturedTrainers.tsx` — self-hiding Elite coach section
- `Cenlar demand gt 1-17/src/components/landing/FeaturedTrainers.test.tsx` — 2 render/hide behavior tests
- `Cenlar demand gt 1-17/src/pages/Landing.tsx` — FeaturedTrainers import + placement above BestDeals

## Decisions Made

- tierScore IIFE inline in rankTrainers — keeps the function self-contained, no separate helper to import
- FeaturedTrainers null/[] distinction is the single gate: loading returns null, empty returns null (SRCH-03 — no layout shift)
- Landing.tsx has no conditional around FeaturedTrainers — same self-hiding pattern used by ReferralLeaderboard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2783 duplicate key in useTrainers.test.ts makeTrainer helper**
- **Found during:** Task 2 TypeScript verification
- **Issue:** Plan template had `id: overrides.id` as explicit property AND `...overrides` spread — TS2783 duplicate key error
- **Fix:** Destructured `{ id, ...rest }` from the parameter, used `id` as property and spread `rest`
- **Files modified:** `Cenlar demand gt 1-17/src/hooks/useTrainers.test.ts`
- **Commit:** `b5b5caf`

## Issues Encountered

None beyond the auto-fixed TS2783 above. All pre-existing TypeScript errors in ReferralLeaderboard, AnalyticsTab, PayoutsTab are out of scope for this plan.

## User Setup Required

None.

## Next Phase Readiness

- SRCH-01/02/03 complete — tier-aware ranking and Elite featured section fully delivered
- Phase 14 Plan 04 is the final plan in Phase 14
- Phase 15 (Subscription UI) can begin: subscription tier badges, bio char counter, slot limit UI

## Self-Check

- [x] `Cenlar demand gt 1-17/src/hooks/useTrainers.ts` — modified (tierScore injected)
- [x] `Cenlar demand gt 1-17/src/hooks/useTrainers.test.ts` — created (3 tests GREEN)
- [x] `Cenlar demand gt 1-17/src/components/landing/FeaturedTrainers.tsx` — created
- [x] `Cenlar demand gt 1-17/src/components/landing/FeaturedTrainers.test.tsx` — created (2 tests GREEN)
- [x] `Cenlar demand gt 1-17/src/pages/Landing.tsx` — modified (FeaturedTrainers above BestDeals)
- [x] commit `04dd145` — Task 1
- [x] commit `b5b5caf` — Task 2
- [x] 20/20 tests GREEN via `npx vitest run`
- [x] No TypeScript errors in plan files

## Self-Check: PASSED

---
*Phase: 14-feature-gates-+-search*
*Completed: 2026-03-16*
