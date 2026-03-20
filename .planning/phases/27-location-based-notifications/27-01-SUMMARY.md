---
phase: 27-location-based-notifications
plan: 01
subsystem: notifications
tags: [location, postgis, notifications, hooks, tdd]
dependency_graph:
  requires: [23-map-view-trainer-locations]
  provides: [client_notification_preferences table, notify_nearby_clients trigger, useNotificationPreferences hook, useLookingNow hook]
  affects: [trainer_profiles, notifications]
tech_stack:
  added: []
  patterns: [SECURITY DEFINER trigger function, PostGIS ST_DWithin geography, vi.hoisted() mock pattern, waitFor for async hook tests]
key_files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260320100000_location_notifications.sql"
    - "Cenlar demand gt 1-17/src/types/notifications.ts"
    - "Cenlar demand gt 1-17/src/hooks/useNotificationPreferences.ts"
    - "Cenlar demand gt 1-17/src/hooks/useNotificationPreferences.test.ts"
    - "Cenlar demand gt 1-17/src/hooks/useLookingNow.ts"
    - "Cenlar demand gt 1-17/src/hooks/useLookingNow.test.ts"
  modified: []
decisions:
  - "Use sonner (not react-hot-toast) for toast.error in useLookingNow — project-wide toast library"
  - "vi.hoisted() for supabase mock variable hoisting in Vitest + waitFor instead of act() for async hook tests (React 19 + testing-library v16 compatibility)"
  - "Universal mock chain supports both select/eq/limit (fetch) and upsert/update paths from same from() return"
metrics:
  duration: 10 minutes
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 6
  tests_added: 10
---

# Phase 27 Plan 01: Location-Based Notifications DB Foundation Summary

Database infrastructure and React hooks for location-based trainer notifications: PostGIS proximity trigger with dual frequency caps, preferences CRUD hook with isConfigured gate, and GPS "Looking Now" mode with 2hr auto-disable.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | DB migration + TypeScript types | 0537e9b | 20260320100000_location_notifications.sql, src/types/notifications.ts |
| 2 | useNotificationPreferences + useLookingNow hooks | 2613ea2 | useNotificationPreferences.ts, useLookingNow.ts + test files |

## What Was Built

### Migration (20260320100000_location_notifications.sql)

- `client_notification_preferences` table with columns: `id`, `user_id` (UNIQUE ref to profiles), `notif_enabled`, `area_label`, `area_lat/lng`, `notif_radius_miles` (1-10, default 5), timestamps
- RLS policy: "client manages own notif prefs" FOR ALL with user_id auth gate
- `set_updated_at()` trigger reuse for `updated_at` automation
- `notify_nearby_clients()` SECURITY DEFINER function:
  - Guards: only fires on `availability_status` change to 'live', requires `active_location_id` non-null
  - PostGIS `extensions.ST_DWithin` with `extensions.geography` cast for meter-based radius
  - Daily cap: max 3 `trainer_live_nearby` notifications per client per 24 hours
  - Trainer cooldown: max 1 notification per trainer per client per 4 hours
  - Inserts notification with type='trainer_live_nearby', title, message, link
- `trainer_went_live_notify_clients` AFTER UPDATE trigger on `trainer_profiles`

### TypeScript Types (src/types/notifications.ts)

- `ClientNotificationPreferences` interface exported with all 9 fields

### useNotificationPreferences Hook

- Fetches preferences on mount, exposes `preferences`, `loading`, `savePreferences`, `toggleEnabled`, `isConfigured`, `refetch`
- `isConfigured`: gate computed as `notif_enabled && area_lat != null && area_lng != null` — required by NOTIF-06
- Uses `(supabase as any)` cast per project convention

### useLookingNow Hook

- `activate()`: calls `navigator.geolocation.getCurrentPosition`, sets `livePosition`, starts 2hr setTimeout auto-disable
- `deactivate()`: clears timer, resets state
- Cleanup useEffect clears timeout on unmount
- Uses sonner `toast.error` for location denied error

## Test Results

10/10 tests pass across both hook test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used sonner instead of react-hot-toast for toast notifications**
- **Found during:** Task 2 (test run)
- **Issue:** Plan specified `toast.error('Location access denied')` but didn't specify library. Hook initially imported `react-hot-toast` which is not installed in this project.
- **Fix:** Changed import to `{ toast } from 'sonner'` — the project-wide toast library
- **Files modified:** `src/hooks/useLookingNow.ts`, `src/hooks/useLookingNow.test.ts`
- **Commit:** 2613ea2

**2. [Rule 1 - Bug] vi.hoisted() + waitFor pattern for async hook testing**
- **Found during:** Task 2 (test execution)
- **Issue:** React 19 + @testing-library/react v16 + Vitest 4: `await act(async () => {})` hangs indefinitely. `vi.mock` factory hoisting makes plain `const mockFn = vi.fn()` inaccessible in factory.
- **Fix:** Used `vi.hoisted()` to create the mock function before hoist, and replaced `act()` with `waitFor(() => expect(loading).toBe(false))` for mount settling.
- **Files modified:** `src/hooks/useNotificationPreferences.test.ts`
- **Commit:** 2613ea2

## Self-Check: PASSED

All created files found on disk. Both commits (0537e9b, 2613ea2) verified in git log.
