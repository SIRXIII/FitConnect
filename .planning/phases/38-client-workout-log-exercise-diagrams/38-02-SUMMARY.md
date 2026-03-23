---
phase: 38-client-workout-log-exercise-diagrams
plan: "02"
subsystem: client-ui
tags: [workout-logging, exercise-search, client-dashboard, supabase, framer-motion]
dependency_graph:
  requires: ["38-01"]
  provides: ["38-03"]
  affects: ["ClientDashboard", "WorkoutLogForm", "WorkoutTab"]
tech_stack:
  added: []
  patterns: ["AnimatePresence accordion", "useCallback+useEffect fetch pattern", "(supabase as any) for untyped tables"]
key_files:
  created:
    - "Cenlar demand gt 1-17/src/components/client/WorkoutLogForm.tsx"
    - "Cenlar demand gt 1-17/src/components/client/WorkoutTab.tsx"
  modified:
    - "Cenlar demand gt 1-17/src/pages/ClientDashboard.tsx"
decisions:
  - "Exercise picker shows all EXERCISES when query is empty, sliced to 20 results to keep list manageable"
  - "weightUnit state is global to form (all sets share same unit) matching the plan spec"
  - "Custom exercises fall back to 'core' muscle group for ExerciseDiagram since no group is known"
metrics:
  duration: "2m 20s"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 38 Plan 02: Client Workout Log UI Summary

Client-facing workout log UI: exercise search form with set entry and lbs/kg toggle writing to `workout_logs` + `workout_exercises`, paginated history list with expandable accordions and ExerciseDiagram illustrations, wired into ClientDashboard Workouts tab.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WorkoutLogForm and WorkoutTab components | be1513d | WorkoutLogForm.tsx, WorkoutTab.tsx |
| 2 | Wire Workouts tab into ClientDashboard | 48f5dc5 | ClientDashboard.tsx |

## What Was Built

**WorkoutLogForm.tsx** (284 lines)
- Props: `userId`, optional `bookingId`, `onSaved` callback
- Exercise picker with `searchExercises` query, `ExerciseDiagram` thumbnail (size 32) per result, tap-to-add
- Custom exercise input with name prompt, adds with `exerciseKey = null`
- Per-exercise set rows: reps + weight inputs, global lbs/kg toggle, add/remove set
- Framer Motion `AnimatePresence` + `layout` for exercise list enter/exit
- Save: validates at least 1 exercise with reps > 0, inserts to `workout_logs` then `workout_exercises`, calls `onSaved` on success

**WorkoutTab.tsx** (230 lines)
- Props: `userId`
- Fetches `workout_logs` with `workout_exercises(*)` via `(supabase as any)`, page-based (10 per page)
- `Log Workout` button toggles `WorkoutLogForm` inline (animated open/close)
- Paginated log cards with date, exercise count, notes preview, expandable accordion
- Expanded view: `ExerciseDiagram` (size 36) + exercise name + sets formatted with `formatSet`
- `Load More` button when `hasMore`, empty state with prompt text

**ClientDashboard.tsx** (8 lines changed)
- Added `Dumbbell` to lucide-react import
- Added `import WorkoutTab`
- Extended `TabId` union to include `'workouts'`
- Added `{ id: 'workouts', label: 'Workouts', icon: <Dumbbell size={11} /> }` after Fitness Profile tab
- Added `{activeTab === 'workouts' && <WorkoutTab userId={user!.id} />}` render case

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

- Pre-existing: 5 failures in `AdminDashboard.test.tsx` (unrelated to this plan, present before changes)
- No regressions: 152 tests passing before and after changes

## Self-Check: PASSED

- WorkoutLogForm.tsx: FOUND
- WorkoutTab.tsx: FOUND
- Commit be1513d: FOUND
- Commit 48f5dc5: FOUND
