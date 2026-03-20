---
phase: 22-availability-toggle-foundation
plan: "02"
subsystem: ui
tags: [react, zustand, framer-motion, supabase-realtime, sonner, tailwind, availability-toggle]

dependency_graph:
  requires:
    - phase: 22-01
      provides: "trainer_profiles availability columns, booking_requests table, supabase.ts types"
  provides:
    - "useAvailabilitySession hook — full offline/going_live/live state machine with Supabase writes"
    - "AvailabilityHeader sticky bar — fixed top-16 z-40 h-16 with toggle, countdown, sleep timer pills"
    - "LiveToggle — 3-state pill with 5s framer-motion warm-up progress bar, AnimatePresence cross-fades"
    - "SleepTimerPills — 1hr/2hr/4hr/EOD pill group with BillingToggle pattern"
    - "CountdownDisplay — accessible countdown text with aria-live, tabular-nums, tap-to-extend"
    - "TrainerDashboard updated — AvailabilityHeader rendered above tabs, padding adjusted to pt-48"
  affects:
    - "plan 03 — BookSession RPC (header now in place, trainers can go live before booking)"
    - "phase 23 — Map View (availability_status drives live trainer markers)"

tech_stack:
  added: []
  patterns:
    - "Warm-up state isolation — DB write happens AFTER 5s warmup completes, not during (Pitfall 5)"
    - "Local UI state (uiStatus) synced from Zustand trainerProfile but not stored in Zustand"
    - "Realtime subscription with trainer-specific channel name to avoid collisions"
    - "setSleepTimer/extendTimer write to DB then call fetchProfile to refresh Zustand"
    - "Going-offline warning queries upcoming bookings count before allowing offline transition"
    - "First-time tooltip stored/dismissed in localStorage key fitrush_toggle_tooltip_dismissed"

key_files:
  created:
    - "Cenlar demand gt 1-17/src/hooks/useAvailabilitySession.ts"
    - "Cenlar demand gt 1-17/src/components/trainer/AvailabilityHeader.tsx"
    - "Cenlar demand gt 1-17/src/components/trainer/LiveToggle.tsx"
    - "Cenlar demand gt 1-17/src/components/trainer/SleepTimerPills.tsx"
    - "Cenlar demand gt 1-17/src/components/trainer/CountdownDisplay.tsx"
  modified:
    - "Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx"

key-decisions:
  - "[22-02] DB write on goLive fires after 5s timeout completes — keeps trainer offline to clients during warm-up (Pitfall 5 compliance)"
  - "[22-02] cancelWarmup clears setTimeout and sets uiStatus=offline without DB write — DB never changed during warm-up"
  - "[22-02] AvailabilityHeader positioned at top-16 z-40; TrainerDashboard outer div padding changed from pt-32 to pt-48 (nav 64px + header 64px + original gap)"
  - "[22-02] Countdown interval re-creates only when sleep_timer_expires_at changes — avoids tick drift from Zustand re-renders"
  - "[22-02] 10-minute warning fires when remaining is in range 590-600s (not exactly 600) to handle tick jitter"
  - "[22-02] extendTimer adds to remaining time from max(currentExpires, now()), not from now() — correct extend-on-top semantics"

patterns-established:
  - "Pattern: warm-up state isolation — uiStatus going_live is UI-only, DB stays offline until warm-up completes"
  - "Pattern: Realtime channel name includes trainer ID — trainer-availability-${trainerProfile.id}"

requirements-completed: [AVAIL-01, AVAIL-02]

duration: 1min
completed: "2026-03-19"
---

# Phase 22 Plan 02: Availability Toggle Foundation Summary

**Uber-style live toggle with 5-second warm-up animation, sleep timer pills (1hr/2hr/4hr/EOD), live countdown, and 10-minute warning toast — all wired to Supabase via useAvailabilitySession hook and rendered in a sticky AvailabilityHeader above TrainerDashboard tabs.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-19T17:57:30Z
- **Completed:** 2026-03-19T17:58:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- useAvailabilitySession hook implements complete offline/going_live/live state machine with 5s warm-up timeout, Supabase writes, countdown interval, 10-minute warning toast, and Realtime subscription
- AvailabilityHeader sticky bar renders below global nav with live toggle, booking mode selector, countdown display, sleep timer pills, first-time tooltip, and going-offline warning
- LiveToggle, SleepTimerPills, CountdownDisplay created with proper accessibility attributes, framer-motion animations, and UI-SPEC typography/color contracts

## Task Commits

Each task was committed atomically:

1. **Task 1: useAvailabilitySession hook + AvailabilityHeader + TrainerDashboard integration** - `a719297` (feat)
2. **Task 2: LiveToggle, SleepTimerPills, CountdownDisplay components** - `596d01e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/hooks/useAvailabilitySession.ts` - Full availability state machine, countdown, Supabase writes, Realtime sync
- `src/components/trainer/AvailabilityHeader.tsx` - Sticky header bar with toggle, status, countdown, sleep timer
- `src/components/trainer/LiveToggle.tsx` - Toggle pill with offline/going_live/live states and warm-up progress bar
- `src/components/trainer/SleepTimerPills.tsx` - 1hr/2hr/4hr/EOD pill buttons with BillingToggle pattern
- `src/components/trainer/CountdownDisplay.tsx` - Live countdown text with aria-live and tap-to-extend
- `src/pages/TrainerDashboard.tsx` - Added AvailabilityHeader import/render, updated padding pt-32 -> pt-48

## Decisions Made

- DB write on goLive fires after the 5s setTimeout completes — trainer stays offline in DB during warm-up, then becomes live atomically. This ensures clients never see a "live" trainer who is still in the warm-up UI animation.
- cancelWarmup clears the pending setTimeout and resets uiStatus to 'offline' without touching the DB — correct because no DB write happened during warm-up.
- AvailabilityHeader positioned at `top-16 z-40`: nav uses dynamic padding (py-4 scrolled / py-8 unscrolled, no fixed height class) but the dashboard's original `pt-32` accounts for nav spacing. Adding the header pushes content padding to `pt-48` (nav offset 32 + header 16 = 48).
- 10-minute warning fires when `remaining <= 600 && remaining > 590` to handle tick jitter (1s interval may skip exact 600).
- extendTimer computes base as `max(currentExpires, now())` so extension adds to remaining time, not from now.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing AdminDashboard.test.tsx failure (1 test, unrelated) was confirmed in plan 01 and persists unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Trainer availability toggle is fully functional: header renders on dashboard, toggle transitions through offline/going_live/live, sleep timer pills set auto-off, countdown shows remaining time
- All components follow UI-SPEC colors, typography, and animation contracts
- Plan 03 (BookSession RPC integration) can proceed — the availability foundation and DB schema are in place
- Phase 23 (Map View) can use availability_status from trainer_profiles for live trainer markers

---
*Phase: 22-availability-toggle-foundation*
*Completed: 2026-03-19*
