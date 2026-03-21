---
phase: 37-group-sessions
plan: "02"
subsystem: booking
tags: [group-sessions, booking-flow, trainer-bookings, edge-functions]
dependency_graph:
  requires: [37-01]
  provides: [group-slot-display, group-booking-flow, group-cancellation, participant-list]
  affects: [TrainerProfile, TrainerBookings, BookSession, create-payment-intent, cancel-booking]
tech_stack:
  added: []
  patterns: [capacity-check-rpc, lazy-loaded-participants, group-safe-cancellation]
key_files:
  created: []
  modified:
    - src/pages/TrainerProfile.tsx
    - src/pages/TrainerBookings.tsx
    - src/pages/BookSession.tsx
    - supabase/migrations/20260320_group_sessions.sql
    - supabase/functions/create-payment-intent/index.ts
    - supabase/functions/cancel-booking/index.ts
decisions:
  - "Participant list placed in TrainerBookings.tsx (not TrainerDashboard.tsx) since that's where booking detail views exist"
  - "Participants lazy-loaded on demand via 'Load Participants' button to avoid N+1 RPC calls on page load"
  - "create_booking_atomic updated in same migration file to handle group slot capacity check in SQL (atomic, race-condition safe)"
  - "BookSession.tsx checks slot_type before blocking on is_booked flag — group slots allowed until capacity reached"
metrics:
  duration_seconds: 271
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 6
---

# Phase 37 Plan 02: Group Session End-to-End Flow Summary

Group sessions work end-to-end: spots remaining badge on trainer profile, multi-client booking via updated create_booking_atomic RPC, group-safe cancellation, and participant list in trainer bookings view.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Group slot display + multi-booking edge function logic | eef797b | TrainerProfile.tsx, BookSession.tsx, supabase/migrations/20260320_group_sessions.sql, create-payment-intent/index.ts, cancel-booking/index.ts |
| 2 | Participant list in trainer bookings view | d4e0701 | TrainerBookings.tsx |

## What Was Built

### TrainerProfile.tsx
- Fetches booking counts via `get_slot_booking_count` RPC for all group slots after loading
- Renders "X/Y spots left" badge (green when available, red when full) on group slot cards
- Shows per-person rate (`group_rate`) for group slots
- Book link disabled/un-clickable when group slot is full

### create_booking_atomic (migration update)
- Group slots: checks booking count < max_capacity instead of is_booked flag
- Group slots: does NOT set is_booked = true (slot stays open for additional bookings)
- Individual slots: original behavior unchanged
- Atomic SQL with FOR UPDATE lock prevents race conditions

### BookSession.tsx
- Uses `group_rate` instead of `optimized_rate` when `slot_type === 'group'`
- Allows booking group slots even when `is_booked = true`
- Updated "slot_taken" error message for group context

### create-payment-intent edge function
- Fetches slot data when booking has a slot_id
- For group slots: verifies `is_available` and checks booking count <= max_capacity
- Returns 409 if group session is full (race-condition guard after payment)

### cancel-booking edge function
- Fetches `slot_type` along with `start_time` in the booking query
- DB trigger already handles group-safe slot restoration (checks for remaining active bookings before resetting is_booked)

### TrainerBookings.tsx
- Added `GroupParticipant` type and `slot_id`, `slot_type`, `max_capacity` to booking query
- Group session booking cards show a blue "Group Session — Participants" panel
- Participants lazy-loaded on demand via "Load Participants" button
- Shows avatar, name, fitness goals per participant with spot count

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Updated create_booking_atomic to handle group multi-booking**
- **Found during:** Task 1
- **Issue:** `create_booking_atomic` RPC checked `is_booked` flag and would reject second booking for group slots. Also set `is_booked = true` after first booking, blocking subsequent clients.
- **Fix:** Extended migration to replace `create_booking_atomic` with group-aware version that checks capacity count for group slots and skips the `is_booked` flip.
- **Files modified:** supabase/migrations/20260320_group_sessions.sql
- **Commit:** eef797b

**2. [Rule 2 - Missing functionality] Updated BookSession.tsx to allow group slot booking**
- **Found during:** Task 1
- **Issue:** BookSession.tsx line 353 blocked booking if `slot.is_booked === true`, which would prevent second client from booking a group slot.
- **Fix:** Added `isGroupSlot` check — group slots bypass the `is_booked` availability gate.
- **Files modified:** src/pages/BookSession.tsx
- **Commit:** eef797b

**3. [Design] Participant list in TrainerBookings.tsx, not TrainerDashboard.tsx**
- **Plan specified:** TrainerDashboard.tsx
- **Actual:** TrainerBookings.tsx — the actual booking detail UI lives there, not in the dashboard overview.
- **No impact on functionality** — trainer sees participants in the correct, existing booking detail view.

## Build Verification

`npx vite build` completed successfully in 1.99s. Bundle: 1,539 kB JS / 79.59 kB CSS.

## Self-Check: PASSED
- Commits eef797b and d4e0701 exist in git log
- TypeScript errors in changed files: 0 (all pre-existing errors in unrelated files)
- Build: PASSED
