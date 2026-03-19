---
phase: 25-ai-trainer-client-matching
plan: "01"
subsystem: matching-engine
tags: [scoring, matching, tdd, migration, client-passport]
dependency_graph:
  requires: []
  provides: [matchScoring-module, hourly_budget_max-column, passport-budget-field]
  affects: [25-02-recommended-carousel]
tech_stack:
  added: []
  patterns: [pure-function-scoring, localStorage-cache, supabase-as-any-cast, tdd-red-green]
key_files:
  created:
    - Cenlar demand gt 1-17/supabase/migrations/20260319400000_add_hourly_budget_max.sql
    - Cenlar demand gt 1-17/src/lib/matchScoring.ts
    - Cenlar demand gt 1-17/src/lib/matchScoring.test.ts
  modified:
    - Cenlar demand gt 1-17/src/pages/ClientPassport.tsx
decisions:
  - "localStorage for match cache (vs Supabase table): simpler, zero-infrastructure, sufficient for single-device MVP"
  - "Single hourly_budget_max (not min+max range): simplifies scoring and UI; neutral 30/60 fallback when null"
  - "clearMatchCache on ALL saveField calls (not just budget/gating fields): any passport change should invalidate stale matches"
  - "localStorage mock via vi.stubGlobal in tests: jsdom environment has localStorage but --localstorage-file warning indicates it is not fully initialized; inline mock is reliable"
metrics:
  duration: 2m 54s
  completed: 2026-03-19T19:42:00Z
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 25 Plan 01: Match Scoring Engine + Passport Budget Field Summary

**One-liner:** Deterministic 100-point match scoring engine (60pt price + 40pt goals, specialtyToWorkoutTypes lookup, profileConstants labels) with localStorage 24hr cache, hourly_budget_max migration, and ClientPassport budget field with cache bust on save.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | DB migration + matchScoring module + unit tests (TDD) | 9810233 | migrations/20260319400000_add_hourly_budget_max.sql, src/lib/matchScoring.ts, src/lib/matchScoring.test.ts |
| 2 | ClientPassport budget field + cache bust on save | a2d58dc | src/pages/ClientPassport.tsx |

## What Was Built

### matchScoring.ts (6 exports)

- `scoreTrainer(client, trainer)`: 60pt price score (full when rate <= budget; partial credit for over-budget; 30 neutral when budget null) + 40pt goals score (specialtyToWorkoutTypes lookup, intersection with client goals+workout_types, 20pts/match). Reasons use real values: `"Within your $60/hr budget"`, `"Matches your HIIT goals"` (label from profileConstants).
- `rankAndFilter(client, trainers, topN=3)`: Maps scoreTrainer, filters score < 40, sorts descending, slices topN.
- `isPassportReady(cp)`: Returns true when fitness_level truthy AND goals_ranked.length >= 1 AND workout_types.length >= 1.
- `getCachedMatches(userId)`: Reads `match_cache_{userId}` from localStorage, returns null if missing or > 24hr old.
- `setCachedMatches(userId, results)`: Writes `{ data, ts }` to localStorage.
- `clearMatchCache(userId)`: Removes localStorage key.

### Migration

`20260319400000_add_hourly_budget_max.sql`: Adds `hourly_budget_max integer` column to `client_profiles` (nullable, with COMMENT).

### ClientPassport.tsx changes

- Import `clearMatchCache` from `@/lib/matchScoring`
- New `hourlyBudgetMax` state (`number | ''`)
- `hourly_budget_max` added to DB select query, state loaded on mount
- Budget input field in Preferences section: `$` prefix, number input (min 0, max 500, step 5), auto-save on blur, `/hr` suffix, helper text
- `saveField` now calls `clearMatchCache(user.id)` after every successful save
- Budget field NOT in COMPLETION_FIELDS (optional for scoring)

### Unit Tests (18 passing)

All behavior items covered: price fit (within budget, over budget, null budget), goals alignment (matching specialty, non-matching), reason text (real budget value, profileConstants label), rankAndFilter (topN, floor filter, sort order), isPassportReady (all 4 conditions), cache (no-cache null, within TTL, expired TTL, clearMatchCache).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] localStorage.clear not available in jsdom test environment**
- **Found during:** Task 1, GREEN step (test run)
- **Issue:** Vitest jsdom environment warns `--localstorage-file was provided without a valid path` and `localStorage.clear is not a function`, causing 4 cache tests to fail
- **Fix:** Added inline localStorage mock (`localStorageMock`) in test file, used `vi.stubGlobal('localStorage', localStorageMock)` in `beforeEach` — consistent with project convention of working around jsdom limitations (Phase 23.1-02 note: "Use .toBeTruthy() not .toBeInTheDocument()")
- **Files modified:** Cenlar demand gt 1-17/src/lib/matchScoring.test.ts
- **Commit:** 9810233

## Decisions Made

1. **localStorage cache over Supabase table**: Zero infrastructure, sufficient for MVP single-device use. Upgrade path to Supabase `match_cache` table remains open (would add cross-device sync).
2. **Single `hourly_budget_max` field (not range)**: Simpler UX (one number input), sufficient for price scoring. Explanation text uses "Within your $N/hr budget" without implying a range.
3. **Cache bust on all `saveField` calls**: Simpler than tracking which fields are "gating" — any passport change is a signal that matches may be stale. Low cost (localStorage removeItem).
4. **Inline localStorage mock in tests**: `vi.stubGlobal` per `beforeEach` is reliable across jsdom environments without requiring a global setup file.

## Self-Check: PASSED

- [x] `Cenlar demand gt 1-17/supabase/migrations/20260319400000_add_hourly_budget_max.sql` exists
- [x] `Cenlar demand gt 1-17/src/lib/matchScoring.ts` exists
- [x] `Cenlar demand gt 1-17/src/lib/matchScoring.test.ts` exists
- [x] `Cenlar demand gt 1-17/src/pages/ClientPassport.tsx` modified
- [x] Commit 9810233 exists (Task 1)
- [x] Commit a2d58dc exists (Task 2)
- [x] 18/18 tests pass
