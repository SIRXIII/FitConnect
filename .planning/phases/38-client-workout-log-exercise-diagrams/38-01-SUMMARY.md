---
phase: 38-client-workout-log-exercise-diagrams
plan: "01"
subsystem: database, ui
tags: [supabase, postgres, rls, typescript, react, svg, vitest]

requires:
  - phase: 24-session-logs
    provides: "session.ts types (ExerciseEntry, SessionLog) that workout.ts must not conflict with"

provides:
  - "workout_logs and workout_exercises DB tables with RLS (client CRUD, trainer read)"
  - "SetEntry, WorkoutExerciseRow, WorkoutLogRow, WorkoutLogWithExercises TypeScript types"
  - "50-exercise EXERCISES catalog with searchExercises and getExerciseByKey functions"
  - "convertWeight (lbs/kg), formatSet, formatSetSummary utility functions"
  - "15 exercise SVG illustrations + 6 muscle group fallback SVGs"
  - "ExerciseDiagram React component with exerciseKey, fallback, onError logic"

affects:
  - 38-02-workout-log-ui
  - 38-03-workout-history

tech-stack:
  added: []
  patterns:
    - "Client-owned vs trainer-owned data separation: workout types live in workout.ts, session types stay in session.ts"
    - "SVG fallback pattern: ExerciseDiagram tries exerciseKey.svg, falls back to _fallback/muscleGroup.svg on error"
    - "Exercise key as stable identifier: keys are snake_case strings linking exerciseList, DB, and SVG assets"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260323100000_workout_logs.sql"
    - "Cenlar demand gt 1-17/src/types/workout.ts"
    - "Cenlar demand gt 1-17/src/lib/exerciseList.ts"
    - "Cenlar demand gt 1-17/src/lib/exerciseList.test.ts"
    - "Cenlar demand gt 1-17/src/lib/workoutUtils.ts"
    - "Cenlar demand gt 1-17/src/lib/workoutUtils.test.ts"
    - "Cenlar demand gt 1-17/src/components/shared/ExerciseDiagram.tsx"
    - "Cenlar demand gt 1-17/public/assets/exercises/ (15 SVGs)"
    - "Cenlar demand gt 1-17/public/assets/exercises/_fallback/ (6 SVGs)"
  modified: []

key-decisions:
  - "workout.ts kept entirely separate from session.ts -- client-owned logs must not conflict with trainer-owned session log types from Phase 24"
  - "exercise_key is nullable in DB and types -- custom exercises entered by client have no key and fall back to muscle group SVG"
  - "SVG fallback implemented via React useState + onError rather than CSS background-image -- enables server-side rendering and accessibility attrs"
  - "convertWeight rounds lbs->kg to 1 decimal, kg->lbs to nearest integer -- matches common gym display conventions"

patterns-established:
  - "ExerciseDiagram fallback chain: exerciseKey.svg -> _fallback/muscleGroup.svg (never a broken image)"
  - "searchExercises returns full catalog on empty query -- enables show-all-on-focus UX without separate fetch"

requirements-completed: [LOG-01, LOG-02, LOG-03, LOG-04]

duration: 5min
completed: 2026-03-23
---

# Phase 38 Plan 01: Client Workout Log -- Data Foundation Summary

**PostgreSQL tables with RLS, 50-exercise catalog, weight/set utilities, 21 SVG illustrations, and ExerciseDiagram component for client workout logging**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T20:27:38Z
- **Completed:** 2026-03-23T20:32:11Z
- **Tasks:** 2
- **Files modified:** 28 (7 TS/SQL + 21 SVG)

## Accomplishments

- Migration creates workout_logs and workout_exercises with 4 RLS policies (client CRUD + trainer read on both tables)
- 50 exercises cataloged across 6 muscle groups with case-insensitive search and key lookup; 17 unit tests pass
- 15 exercise line-art SVGs and 6 muscle group fallback SVGs at under 1KB each; ExerciseDiagram handles missing assets gracefully

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration, TypeScript types, exercise catalog, utility functions** - `4918543` (feat)
2. **Task 2: SVG exercise illustrations and ExerciseDiagram component** - `a74d522` (feat)

**Plan metadata:** (docs commit -- see below)

## Files Created/Modified

- `supabase/migrations/20260323100000_workout_logs.sql` - workout_logs + workout_exercises tables, indexes, 4 RLS policies
- `src/types/workout.ts` - SetEntry, WorkoutExerciseRow, WorkoutLogRow, WorkoutLogWithExercises interfaces
- `src/lib/exerciseList.ts` - 50-exercise EXERCISES array, searchExercises, getExerciseByKey
- `src/lib/exerciseList.test.ts` - 8 unit tests for catalog and search
- `src/lib/workoutUtils.ts` - convertWeight, formatSet, formatSetSummary
- `src/lib/workoutUtils.test.ts` - 9 unit tests for conversion and formatting
- `src/components/shared/ExerciseDiagram.tsx` - img-based component with useState fallback on onError
- `public/assets/exercises/*.svg` - 15 exercise illustrations (bench_press, squat, deadlift, etc.)
- `public/assets/exercises/_fallback/*.svg` - 6 muscle group icons (chest, back, legs, shoulders, arms, core)

## Decisions Made

- workout.ts kept entirely separate from session.ts -- client-owned logs must not conflict with trainer-owned session log types from Phase 24
- exercise_key is nullable in DB and types -- custom exercises entered by client have no key and fall back to muscle group SVG
- SVG fallback implemented via React useState + onError rather than CSS background-image
- convertWeight rounds lbs to kg to 1 decimal place, kg to lbs to nearest integer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

5 pre-existing test failures in AdminDashboard.test.tsx were present before this plan and are out of scope. All new tests pass (17/17).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All shared contracts (types, exercise catalog, utilities, SVGs, ExerciseDiagram) are ready
- Plans 02 (WorkoutLogModal UI) and 03 (WorkoutHistory view) can now execute in parallel without conflicts
- Migration must be applied to Supabase before Plans 02/03 use the tables

---
*Phase: 38-client-workout-log-exercise-diagrams*
*Completed: 2026-03-23*

## Self-Check: PASSED

- migration: FOUND
- workout.ts: FOUND
- exerciseList.ts: FOUND
- workoutUtils.ts: FOUND
- ExerciseDiagram.tsx: FOUND
- 15 exercise SVGs + 6 fallback SVGs: FOUND
- Commit 4918543: FOUND
- Commit a74d522: FOUND
