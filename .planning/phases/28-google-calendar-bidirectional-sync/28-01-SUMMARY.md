---
phase: 28-google-calendar-bidirectional-sync
plan: 01
subsystem: database
tags: [google-calendar, oauth, postgres, rls, deno, edge-functions, rpc, pg-cron]

# Dependency graph
requires:
  - phase: 22-availability-toggle-foundation
    provides: availability_slots table, get_visible_slots RPC, pg_cron graceful fallback pattern
  - phase: 19-buffer-enforcement
    provides: get_visible_slots current implementation to extend
provides:
  - google_calendar_connections table with RLS + service_role policies
  - gcal_blocked_slots table with UNIQUE constraint on (trainer_id, gcal_event_id)
  - bookings.gcal_event_id column
  - availability_slots.is_gcal_blocked column
  - apply_gcal_blocks RPC (tstzrange overlap mark/unmark)
  - get_visible_slots updated with is_gcal_blocked = false filter
  - supabase/functions/_shared/gcal-helpers.ts (token refresh, retry, CRUD, fitrush tagging)
  - src/types/gcal.ts (GcalConnection, GcalBlockedSlot interfaces)
  - src/pages/GoogleCalendarCallback.tsx (OAuth popup postMessage flow)
  - /auth/google-callback route in App.tsx
affects: [28-02, 28-03, sync-gcal-events edge function, connect-gcal edge function]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deno Edge Function shared module pattern: gcal-helpers.ts co-located in _shared/"
    - "OAuth popup flow: popup postMessage to opener then self.close()"
    - "GCal sync loop prevention: extendedProperties.private.source=fitrush on all FitRush-created events"
    - "token refresh with 60s buffer: check expires_at - 60s before making requests"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260320200000_google_calendar_sync.sql"
    - "Cenlar demand gt 1-17/src/types/gcal.ts"
    - "Cenlar demand gt 1-17/supabase/functions/_shared/gcal-helpers.ts"
    - "Cenlar demand gt 1-17/src/pages/GoogleCalendarCallback.tsx"
  modified:
    - "Cenlar demand gt 1-17/src/App.tsx"

key-decisions:
  - "gcal-helpers listGcalEvents uses privateExtendedProperty=source!=fitrush to exclude FitRush booking events from being treated as blocks (Pitfall 4 prevention)"
  - "getValidAccessToken includes 60s expiry buffer to avoid races with near-expired tokens"
  - "GoogleCalendarCallback not wrapped in ProtectedRoute — popup window has no auth context"
  - "apply_gcal_blocks does two passes: mark new overlaps then unmark stale ones — order matters for correctness"
  - "pg_cron schedule uses double guard (pg_cron AND pg_net) — graceful RAISE NOTICE fallback"

patterns-established:
  - "GCal sync loop prevention: tag all FitRush-created events with extendedProperties.private.source=fitrush"
  - "OAuth popup flow: GoogleCalendarCallback reads code+state, postMessages to opener, closes self"
  - "Token refresh: always check expires_at with 60s buffer before using cached token"

requirements-completed: [CALSYNC-01, CALSYNC-03, CALSYNC-05]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 28 Plan 01: Google Calendar Sync Foundation Summary

**DB tables, shared Edge Function helpers, TS types, and OAuth popup callback for Google Calendar bidirectional sync using tstzrange overlap, invalid_grant revocation handling, and fitrush source tagging**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T21:10:02Z
- **Completed:** 2026-03-19T21:12:10Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Complete DB foundation: google_calendar_connections + gcal_blocked_slots tables, new columns on bookings and availability_slots, apply_gcal_blocks RPC, updated get_visible_slots
- Shared gcal-helpers module with token refresh (invalid_grant handling), exponential backoff retry, and all GCal CRUD operations with fitrush source tagging to prevent sync loops
- OAuth popup flow wired end-to-end: GoogleCalendarCallback page + /auth/google-callback route in App.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration for Google Calendar sync tables and RPC updates** - `c116a0e` (feat)
2. **Task 2: TypeScript types, shared GCal helpers, and OAuth callback page** - `eeece44` (feat)

**Plan metadata:** _(pending docs commit)_

## Files Created/Modified

- `Cenlar demand gt 1-17/supabase/migrations/20260320200000_google_calendar_sync.sql` - All 7 sections: tables, columns, apply_gcal_blocks RPC, get_visible_slots update, pg_cron scheduling
- `Cenlar demand gt 1-17/src/types/gcal.ts` - GcalConnection and GcalBlockedSlot TypeScript interfaces
- `Cenlar demand gt 1-17/supabase/functions/_shared/gcal-helpers.ts` - getValidAccessToken, withRetry, createGcalEvent, deleteGcalEvent, listGcalEvents
- `Cenlar demand gt 1-17/src/pages/GoogleCalendarCallback.tsx` - OAuth popup postMessage handler
- `Cenlar demand gt 1-17/src/App.tsx` - Added /auth/google-callback route (no ProtectedRoute wrapper)

## Decisions Made

- `listGcalEvents` filters using `privateExtendedProperty=source!=fitrush` to exclude FitRush booking events from the external event list, preventing FitRush bookings from creating availability blocks on themselves (Pitfall 4)
- `getValidAccessToken` adds a 60-second buffer when checking token expiry to avoid races where a token expires between the check and the API call
- `GoogleCalendarCallback` rendered without ProtectedRoute — the popup window opens before the OAuth flow completes and has no established auth context
- `apply_gcal_blocks` performs two sequential UPDATE passes: first marks new overlaps, then unmarks stale ones; order ensures a slot isn't double-toggled within a single call
- pg_cron schedule guard checks both `pg_cron` AND `pg_net` extensions before scheduling — falls back to RAISE NOTICE so migration never fails on Free tier

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — pre-existing TypeScript errors in unrelated files (Google Maps namespace, Recharts formatter types, payout_transactions) were present before this plan and are out of scope.

## User Setup Required

**External services require manual configuration.** Google Cloud Platform setup is needed before sync features can function:

- Enable Google Calendar API in GCP Console (APIs & Services > Library)
- Create OAuth 2.0 Client ID credentials
- Add authorized redirect URI: `{SITE_URL}/auth/google-callback`
- Add to Supabase Edge Function secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Add to frontend `.env`: `VITE_GOOGLE_CLIENT_ID`

## Next Phase Readiness

Plan 28-02 (OAuth connect UI + connect-gcal Edge Function) can now proceed — all DB tables, TS types, and shared helpers are available.
Plan 28-03 (sync-gcal-events Edge Function) depends on gcal-helpers.ts which is now complete.

Blocker: Google OAuth consent screen verification must complete before sync reaches production users (4-8 week external timeline — start immediately).

---
*Phase: 28-google-calendar-bidirectional-sync*
*Completed: 2026-03-19*
