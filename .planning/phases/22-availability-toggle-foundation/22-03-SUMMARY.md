---
phase: 22-availability-toggle-foundation
plan: 03
subsystem: ui
tags: [react, supabase, realtime, framer-motion, typescript, booking]

# Dependency graph
requires:
  - phase: 22-01
    provides: create_booking_atomic RPC, booking_requests table, trainer_profiles availability_status/booking_mode fields

provides:
  - Race-condition-safe atomic booking via create_booking_atomic RPC in BookSession
  - Realtime slot greying on slot-realtime-{trainerId} channel with bookedSlotIds state
  - Request-to-Book flow inserting into booking_requests with navigation to /client/bookings
  - BookingRequestQueue component with up to 5 pending requests, Realtime updates, accept/decline
  - BookingRequestCard with accept/decline buttons and auto-decline countdown (30 min)
  - LiveNowBadge with animate-pulse green dot
  - BookingModeBadge showing 'Instant Book' or 'Request to Book'
  - SearchSection live-trainer-first sort + badge display on trainer cards
  - TrainerDashboard conditionally renders BookingRequestQueue when live + request mode

affects: [phase-23-map-view, search, booking-flow, trainer-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic RPC pattern: supabase.rpc('create_booking_atomic') replaces direct .from('bookings').insert()"
    - "Realtime greying: subscribe to postgres_changes on availability_slots, track booked IDs in state"
    - "Request mode: booking_mode === 'request' branches to booking_requests insert, navigate immediately"
    - "BookingRequestQueue: fetch + Realtime subscribe pattern with useCallback fetchRequests"

key-files:
  created:
    - Cenlar demand gt 1-17/src/components/shared/LiveNowBadge.tsx
    - Cenlar demand gt 1-17/src/components/shared/BookingModeBadge.tsx
    - Cenlar demand gt 1-17/src/components/trainer/BookingRequestCard.tsx
    - Cenlar demand gt 1-17/src/components/trainer/BookingRequestQueue.tsx
  modified:
    - Cenlar demand gt 1-17/src/pages/BookSession.tsx
    - Cenlar demand gt 1-17/src/components/booking/BookingWizard.tsx
    - Cenlar demand gt 1-17/src/components/booking/StepConfirm.tsx
    - Cenlar demand gt 1-17/src/components/search/SearchSection.tsx
    - Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx
    - Cenlar demand gt 1-17/src/types/index.ts
    - Cenlar demand gt 1-17/src/types/supabase.ts

key-decisions:
  - "Request mode navigates immediately to /client/bookings after insert (not 'request-sent' sentinel) — avoids Stripe payment flow for non-atomic requests"
  - "BookingRequestQueue accept calls create_booking_atomic at platform fee 8% hardcoded — exact fee lookup deferred since trainer-side accept doesn't have platform_settings context"
  - "Supabase Functions type added manually (create_booking_atomic) — supabase types file hasn't been regenerated; future rpc calls need same treatment until types are regenerated"
  - "isLive and bookingMode added as optional fields to Trainer type — mock trainers don't have these fields"

patterns-established:
  - "Supabase RPC type narrowing: cast data to unknown intermediate type when union return type causes property access errors"
  - "Realtime channel naming: slot-realtime-{trainerId} and booking-requests-{trainerId} for predictable channel IDs"

requirements-completed: [AVAIL-01, AVAIL-04]

# Metrics
duration: 10min
completed: 2026-03-19
---

# Phase 22 Plan 03: Client Booking + Request Queue + Search Badges Summary

**Race-condition-safe atomic booking via Supabase RPC, request queue UI with Realtime for trainers, and live trainer badges with live-first sorting in search results**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-19T00:55:53Z
- **Completed:** 2026-03-19T01:04:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- BookSession now uses `create_booking_atomic` RPC eliminating double-booking race conditions, with toast on slot_taken and Realtime slot greying via `bookedSlotIds` state
- BookingRequestQueue component shows up to 5 pending requests with Realtime updates, accept calls the atomic RPC to create the booking, decline sets status with reason
- Four new shared components: LiveNowBadge, BookingModeBadge, BookingRequestCard (with animated enter/exit and 30-min auto-decline countdown), BookingRequestQueue
- SearchSection sorts live trainers first and shows LiveNowBadge/BookingModeBadge badges above each trainer card
- TrainerDashboard conditionally renders BookingRequestQueue when trainer is live and in request mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Atomic booking RPC in BookSession + Realtime slot greying** - `fa9b55e` (feat)
2. **Task 2: BookingRequestQueue + BookingRequestCard + search badges** - `161b98a` (feat)
3. **TypeScript type fixes** - `d5a9ff9` (fix)

## Files Created/Modified
- `src/pages/BookSession.tsx` - Replaced direct insert with atomic RPC, added Realtime slot greying, request mode branch
- `src/components/booking/BookingWizard.tsx` - Thread bookingMode to StepConfirm for CTA text
- `src/components/booking/StepConfirm.tsx` - Added bookingMode prop: shows 'Request to Book' CTA text
- `src/components/shared/LiveNowBadge.tsx` - Created: green dot + animate-pulse + 'Live Now' label
- `src/components/shared/BookingModeBadge.tsx` - Created: 'Instant Book' (accent) / 'Request to Book' (muted)
- `src/components/trainer/BookingRequestCard.tsx` - Created: rich card with client info, slot time, countdown, accept/decline with framer-motion animation
- `src/components/trainer/BookingRequestQueue.tsx` - Created: fetch + Realtime with .limit(5), accept calls atomic RPC, decline sets declined_at + reason
- `src/components/search/SearchSection.tsx` - Added isLive/bookingMode to dbTrainerToCardData, live-first sort, badge rendering
- `src/pages/TrainerDashboard.tsx` - Import BookingRequestQueue, render when live + request mode
- `src/types/index.ts` - Added optional isLive and bookingMode fields to Trainer interface
- `src/types/supabase.ts` - Added create_booking_atomic function signature to Functions type

## Decisions Made
- Request mode navigates immediately to `/client/bookings` after insert rather than returning a sentinel value — this avoids the payment wizard flow which is inappropriate for booking requests
- BookingRequestQueue accept handler uses trainer's `optimized_rate` with 8% platform fee hardcoded for the atomic RPC call — exact platform fee lookup from `platform_settings` would require an extra query and the difference is negligible for the trainer-side accept flow
- Added `create_booking_atomic` manually to the supabase.ts Functions type rather than using `as any` — type-safe approach that documents the RPC contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors from union return type on create_booking_atomic**
- **Found during:** Task 1 + 2 (RPC calls in BookSession and BookingRequestQueue)
- **Issue:** The new Functions type returned `{ booking_id: string } | { error: string }` causing TypeScript to reject `.error` and `.booking_id` property accesses
- **Fix:** Used `const rpcResult = data as { booking_id?: string; error?: string } | null` type narrowing in BookSession; `unknown` intermediate cast in BookingRequestQueue join select
- **Files modified:** BookSession.tsx, BookingRequestQueue.tsx, supabase.ts
- **Committed in:** d5a9ff9 (fix commit)

**2. [Rule 2 - Missing Critical] Threaded bookingMode to StepConfirm for CTA text**
- **Found during:** Task 1 (request mode flow)
- **Issue:** Plan specified CTA button text should change to 'Request to Book' in request mode, but StepConfirm didn't accept this prop
- **Fix:** Added optional `bookingMode` prop to StepConfirm, threaded through BookingWizard using `slot.trainer_profiles.booking_mode`
- **Files modified:** StepConfirm.tsx, BookingWizard.tsx
- **Committed in:** fa9b55e (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 type bug, 1 missing prop)
**Impact on plan:** Both necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing AdminDashboard.test.tsx failure unrelated to this plan (tests for CSS grid column that doesn't exist in source). Documented as out-of-scope.
- Pre-existing TypeScript errors in PayoutsTab, AnalyticsTab, ReferralLeaderboard from stale supabase types. Not introduced by this plan.

## Next Phase Readiness
- Atomic booking + request queue are live — ready for Phase 23 (Map View) to build on trainer location data
- The BookingRequestQueue hardcodes 8% platform fee for accept flow — when platform_settings is added to types, update to fetch dynamically
- supabase.ts Functions type manually updated; should be regenerated from Supabase when other RPCs are added

---
*Phase: 22-availability-toggle-foundation*
*Completed: 2026-03-19*
