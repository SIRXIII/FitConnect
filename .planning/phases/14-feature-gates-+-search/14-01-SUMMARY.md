---
phase: 14-feature-gates-+-search
plan: "01"
subsystem: ui
tags: [vitest, react, zustand, typescript, tier-gates, feature-flags]

# Dependency graph
requires:
  - phase: 12-subscription-foundation
    provides: subscription_tier, subscription_status, trial_ends_at columns on trainer_profiles
  - phase: 13-billing-backend
    provides: webhook writes subscription_tier/status; Zustand auth store reads these via trainerProfile
provides:
  - TIER_GATES registry mapping TierFeature → allowed Tier[]
  - Tier and TierFeature TypeScript types
  - bioLimitForTier helper (free=280, pro/elite=1000)
  - useTier() hook returning { tier, isTrialing, trialEndsAt }
  - useCan(feature) hook with trial bypass (trialing = full access)
  - Vitest wired into vite.config.ts with jsdom environment
affects:
  - 14-feature-gates-+-search (plans 02+: all gate consumers call useCan())
  - 15-subscription-ui (bio char counter, slot limit UI)
  - 16-admin-subscription (no inline tier comparisons)

# Tech tracking
tech-stack:
  added:
    - vitest 4.1.0 (test runner)
    - jsdom (DOM environment for React hook tests)
    - "@testing-library/react" (renderHook for hook tests)
    - "@testing-library/jest-dom" (DOM matchers)
    - "@vitest/ui" (optional UI reporter)
  patterns:
    - Single TIER_GATES registry as source of truth for all feature access rules
    - useCan(feature) as the call site — no inline tier string comparisons in components
    - Trial bypass at hook level (isTrialing=true returns true from useCan regardless of tier)
    - vi.mock('@/stores/auth') pattern for testing hooks that depend on Zustand

key-files:
  created:
    - "Cenlar demand gt 1-17/src/lib/tierGates.ts"
    - "Cenlar demand gt 1-17/src/lib/tierGates.test.ts"
    - "Cenlar demand gt 1-17/src/hooks/useTier.ts"
    - "Cenlar demand gt 1-17/src/hooks/useTier.test.ts"
  modified:
    - "Cenlar demand gt 1-17/vite.config.ts"
    - "Cenlar demand gt 1-17/package.json"

key-decisions:
  - "Trial bypass is unconditional in useCan — isTrialing=true grants access to every feature regardless of tier"
  - "vi.mock('@/stores/auth') pattern chosen for hook isolation without rendering full app tree"
  - "vitest globals:true + environment:jsdom placed in vite.config.ts test block (no separate vitest.config.ts)"

patterns-established:
  - "useCan(feature) call site pattern: every gated component imports and calls useCan — no string comparisons"
  - "TIER_GATES registry extension: add new TierFeature to type union and TIER_GATES object — one place change"
  - "Hook test pattern: vi.mock store, mockReturnValue per test, renderHook to get result"

requirements-completed:
  - TIER-04
  - TIER-05

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 14 Plan 01: Tier Gate Foundation Summary

**TIER_GATES feature registry + useTier/useCan React hooks with full Vitest coverage (15 tests GREEN), establishing the single source of truth for subscription-based feature access**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-16T21:45:20Z
- **Completed:** 2026-03-16T21:47:10Z
- **Tasks:** 2 (TDD: RED then GREEN each)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- Vitest wired into vite.config.ts — `npx vitest run` works with no global install
- tierGates.ts ships: Tier/TierFeature types, TIER_GATES registry, BIO_LIMITS, bioLimitForTier helper
- useTier.ts ships: useTier() and useCan() hooks; trialing trainers get unconditional full access
- 15 tests pass GREEN (7 tierGates + 8 useTier/useCan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Vitest + tierGates.ts** - `513fcc4` (feat)
2. **Task 2: useTier.ts + useCan() hooks** - `4a05a54` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks had RED verify step before implementation (import error = RED confirmed for both)_

## Files Created/Modified
- `Cenlar demand gt 1-17/src/lib/tierGates.ts` - Tier/TierFeature types, TIER_GATES registry (6 features), BIO_LIMITS, bioLimitForTier
- `Cenlar demand gt 1-17/src/lib/tierGates.test.ts` - 7 unit tests for TIER_GATES and bioLimitForTier
- `Cenlar demand gt 1-17/src/hooks/useTier.ts` - useTier() and useCan() hooks consuming TIER_GATES + auth store
- `Cenlar demand gt 1-17/src/hooks/useTier.test.ts` - 8 unit tests with Zustand store mock
- `Cenlar demand gt 1-17/vite.config.ts` - Added vitest reference directive + test block (globals, jsdom)
- `Cenlar demand gt 1-17/package.json` - Added vitest, jsdom, @testing-library/react, @testing-library/jest-dom as devDependencies

## Decisions Made
- Trial bypass is unconditional: `isTrialing=true` in useCan returns true for every feature regardless of tier — matches SaaS trial convention (full access)
- `vi.mock('@/stores/auth')` for hook isolation — avoids Supabase client initialization in test environment
- Vitest config placed inside vite.config.ts test block (not a separate vitest.config.ts) — keeps config surface minimal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — vitest installation, vite.config.ts update, TDD flow, and Zustand mock all worked as specified in the plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- useCan() and useTier() are ready for all consumers in Plans 02+ (bio char counter, slot limits, analytics gating, search priority badges)
- Any new feature gate: add to TierFeature union and TIER_GATES record in tierGates.ts — zero other changes required
- No blockers

## Self-Check

- [x] `Cenlar demand gt 1-17/src/lib/tierGates.ts` — created
- [x] `Cenlar demand gt 1-17/src/lib/tierGates.test.ts` — created
- [x] `Cenlar demand gt 1-17/src/hooks/useTier.ts` — created
- [x] `Cenlar demand gt 1-17/src/hooks/useTier.test.ts` — created
- [x] commit `513fcc4` — Task 1
- [x] commit `4a05a54` — Task 2
- [x] 15/15 tests GREEN via `npx vitest run`
- [x] No TypeScript errors in tierGates.ts or useTier.ts

## Self-Check: PASSED

---
*Phase: 14-feature-gates-+-search*
*Completed: 2026-03-16*
