---
phase: 26-ai-discount-analytics
plan: 01
subsystem: database, api
tags: [postgres, vitest, typescript, rpc, analytics, discount]

# Dependency graph
requires:
  - phase: 25-ai-trainer-client-matching
    provides: matchScoring.ts pattern for pure-TS deterministic scoring libraries
  - phase: 22-availability-toggle-foundation
    provides: availability_slots table and bookings table with status and deleted_at fields
provides:
  - get_trainer_idle_heatmap Postgres RPC returning day/hour grid with total/booked counts
  - get_trainer_slot_utilization Postgres RPC returning aggregate utilization as jsonb
  - slotOptimization.ts pure-TS library with computeDiscountRecommendations, computeOptimizationScore, buildIdleCellMap
  - IdleHeatmapRow, DiscountRecommendation, IdleCell TypeScript interfaces
affects:
  - 26-02 (OptimizationSection UI will consume all three exported functions and both RPCs)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY INVOKER RPCs with status IN ON clause (not WHERE) to preserve LEFT JOIN semantics"
    - "Pure-TS fill-rate math library with no React/Supabase imports, testable in isolation"
    - "TDD: failing test commit -> implementation commit (RED/GREEN pattern)"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260319500000_slot_optimization_rpcs.sql"
    - "Cenlar demand gt 1-17/src/lib/slotOptimization.ts"
    - "Cenlar demand gt 1-17/src/lib/slotOptimization.test.ts"
  modified: []

key-decisions:
  - "Status filter (confirmed/completed) placed in ON clause of LEFT JOIN to avoid inner-join conversion — matches existing RPC convention from phases 10/25"
  - "computeDiscountRecommendations discount tiers: fill_rate <20% gets 25-35, <50% gets 20-30, >=50% gets 10-20 (max = min+10)"
  - "buildIdleCellMap uses string key 'day-hour' for O(1) heatmap cell lookup in Plan 02 UI"

patterns-established:
  - "Slot optimization RPC: SECURITY INVOKER, p_trainer_id/p_start/p_end params, deleted_at IS NULL filter"
  - "Pure fill-rate math: idle_count = total - booked, idle_intensity = idle/total (0-1), optimization_score = round(booked/total * 100)"

requirements-completed: [AIANALYTICS-01, AIANALYTICS-02, AIANALYTICS-03]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 26 Plan 01: AI Discount Analytics Data Layer Summary

**Two SECURITY INVOKER Postgres RPCs for idle heatmap and slot utilization, plus a pure-TS slotOptimization library with fill-rate math and 19 passing Vitest tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T20:13:43Z
- **Completed:** 2026-03-19T20:15:28Z
- **Tasks:** 1 (TDD: 2 commits — RED test + GREEN implementation)
- **Files modified:** 3 created

## Accomplishments
- Created `get_trainer_idle_heatmap` RPC returning day/hour grid (total_count, booked_count) with SECURITY INVOKER, LEFT JOIN status filter in ON clause, and deleted_at guard
- Created `get_trainer_slot_utilization` RPC returning jsonb aggregate for optimization score computation
- Implemented `computeDiscountRecommendations` with three-tier discount system based on fill rate, sorted by idle_count desc
- Implemented `computeOptimizationScore` with division-by-zero guard returning 0-100 integer
- Implemented `buildIdleCellMap` producing Map<string, IdleCell> keyed by "day-hour" for heatmap rendering
- 19 Vitest unit tests covering all behaviors including edge cases (zero totals, fully booked, tiers)

## Task Commits

Each task was committed atomically (TDD pattern):

1. **Task 1 RED: Failing tests** - `882933b` (test)
2. **Task 1 GREEN: Implementation + SQL migration** - `6376dec` (feat)

**Plan metadata:** (docs commit pending)

_Note: TDD tasks have two commits (test -> feat)_

## Files Created/Modified
- `Cenlar demand gt 1-17/supabase/migrations/20260319500000_slot_optimization_rpcs.sql` - Two Postgres RPCs: get_trainer_idle_heatmap and get_trainer_slot_utilization
- `Cenlar demand gt 1-17/src/lib/slotOptimization.ts` - Pure-TS library: three exported functions + three interfaces
- `Cenlar demand gt 1-17/src/lib/slotOptimization.test.ts` - 19 Vitest tests covering all behaviors

## Decisions Made
- Status filter placed in ON clause of LEFT JOIN (not WHERE) to preserve LEFT JOIN semantics — matches existing RPC pattern from prior migrations
- buildIdleCellMap uses `${day_of_week}-${hour}` string key for direct O(1) lookup in UI rendering
- max discount = min + 10 (fixed spread) to keep UI display uniform across all tiers

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Migration will apply on next `supabase db push`.

## Next Phase Readiness
- All three exported functions and both RPCs ready for Plan 02 (OptimizationSection UI)
- IdleHeatmapRow interface matches RPC output shape for type-safe Supabase queries
- Plan 02 can call `supabase.rpc('get_trainer_idle_heatmap', ...)` and pass rows directly to all three functions

## Self-Check: PASSED

- FOUND: Cenlar demand gt 1-17/supabase/migrations/20260319500000_slot_optimization_rpcs.sql
- FOUND: Cenlar demand gt 1-17/src/lib/slotOptimization.ts
- FOUND: Cenlar demand gt 1-17/src/lib/slotOptimization.test.ts
- FOUND: .planning/phases/26-ai-discount-analytics/26-01-SUMMARY.md
- FOUND commit 882933b (test: failing tests)
- FOUND commit 6376dec (feat: implementation + SQL migration)
- Vitest: 19/19 tests passing

---
*Phase: 26-ai-discount-analytics*
*Completed: 2026-03-19*
