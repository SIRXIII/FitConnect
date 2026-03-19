---
phase: 28-google-calendar-bidirectional-sync
plan: 02
subsystem: ui
tags: [google-oauth, calendar-sync, react, supabase-edge-functions, typescript]

# Dependency graph
requires:
  - phase: 28-01
    provides: GcalConnection type, gcal-helpers shared functions, google_calendar_connections DB table, GoogleCalendarCallback popup page

provides:
  - google-calendar-connect Edge Function (OAuth token exchange + disconnect with cleanup)
  - useGcalConnection hook (connection state + connect/disconnect actions)
  - GoogleCalendarConnect UI card (3-state: not connected, connected, reconnect required)
  - TrainerDashboard Calendar tab wired with GoogleCalendarConnect above CalendarExportCard

affects: [28-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - OAuth popup + postMessage listener for code exchange without page navigation
    - CSRF protection via sessionStorage state param in OAuth URL
    - Edge Function handling multiple actions via POST body { action }
    - (supabase as any) cast for unregenerated TS types

key-files:
  created:
    - Cenlar demand gt 1-17/supabase/functions/google-calendar-connect/index.ts
    - Cenlar demand gt 1-17/src/hooks/useGcalConnection.ts
    - Cenlar demand gt 1-17/src/components/calendar/GoogleCalendarConnect.tsx
  modified:
    - Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx

key-decisions:
  - "Edge Function handles both connect and disconnect in one function via action param to keep deploy surface minimal"
  - "prompt=consent + access_type=offline hardcoded in OAuth URL to guarantee refresh_token on every auth (Pitfall 1)"
  - "sessionStorage for CSRF state (not localStorage) — cleared on tab close, scoped to origin, sufficient for OAuth state"
  - "window.confirm for disconnect confirmation — consistent with CalendarExportCard Reset Token pattern"

patterns-established:
  - "OAuth popup pattern: window.open + postMessage listener with CSRF state in sessionStorage"
  - "Multi-action Edge Function: single function with action discriminator instead of separate endpoints"

requirements-completed: [CALSYNC-01, CALSYNC-05]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 28 Plan 02: OAuth Connection Flow Summary

**Google Calendar OAuth connect/disconnect flow via popup window, postMessage, CSRF state, and Edge Function token exchange integrated into TrainerDashboard Calendar tab**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-19T14:04:00Z
- **Completed:** 2026-03-19T14:16:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- google-calendar-connect Edge Function handles full OAuth token exchange (connect) and connection cleanup (disconnect — removes google_calendar_connections row, gcal_blocked_slots, and gcal_event_id from bookings)
- useGcalConnection hook encapsulates connection state with connect/disconnect actions backed by Edge Function invocation
- GoogleCalendarConnect card renders correctly in 3 states: Not Connected (Connect button), Connected (status + last synced + Disconnect), Reconnect Required (amber status + Reconnect button)
- TrainerDashboard Calendar tab shows GoogleCalendarConnect above CalendarExportCard; iCal export unchanged (CALSYNC-05 preserved)

## Task Commits

Each task was committed atomically:

1. **Task 1: google-calendar-connect Edge Function and useGcalConnection hook** - `08ae1a4` (feat)
2. **Task 2: GoogleCalendarConnect UI card and TrainerDashboard integration** - `7bd6710` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `Cenlar demand gt 1-17/supabase/functions/google-calendar-connect/index.ts` - Edge Function for OAuth token exchange (connect) and connection cleanup (disconnect)
- `Cenlar demand gt 1-17/src/hooks/useGcalConnection.ts` - Hook for GCal connection state + connect/disconnect actions
- `Cenlar demand gt 1-17/src/components/calendar/GoogleCalendarConnect.tsx` - Connect/Disconnect UI card with 3-state rendering and OAuth popup flow
- `Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx` - Added GoogleCalendarConnect import + render above CalendarExportCard in calendar tab

## Decisions Made
- Edge Function handles both connect and disconnect in one function via `action` param to keep deploy surface minimal
- `prompt=consent` + `access_type=offline` hardcoded in OAuth URL to guarantee `refresh_token` on every auth (Pitfall 1 compliance)
- `sessionStorage` for CSRF state — cleared on tab close, scoped to origin, sufficient for OAuth popup state validation
- `window.confirm` for disconnect confirmation — consistent with CalendarExportCard Reset Token UX pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing AdminDashboard.test.tsx failure (1 test) was already failing before these changes — confirmed by stashing and re-running. Not a regression.

## User Setup Required
None - no new external service configuration required for this plan. VITE_GOOGLE_CLIENT_ID must be set from Plan 01 setup.

## Next Phase Readiness
- OAuth connection flow complete. Plan 03 can implement bidirectional sync (booking -> GCal event creation, GCal blocked slots import) using the connection data and gcal-helpers from Plans 01-02.
- google-calendar-connect Edge Function must be deployed to Supabase before testing end-to-end.

---
*Phase: 28-google-calendar-bidirectional-sync*
*Completed: 2026-03-19*
