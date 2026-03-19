# Phase 28: Google Calendar Bidirectional Sync - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning
**Source:** Auto-mode (Claude's best judgment based on project patterns)

<domain>
## Phase Boundary

Trainers can connect Google Calendar via OAuth, FitRush bookings auto-sync as GCal events, external GCal events block FitRush slots, booking cancellation removes GCal events, and iCal export continues as fallback.

</domain>

<decisions>
## Implementation Decisions

### OAuth connection flow
- "Connect Google Calendar" button in trainer Settings/Calendar section
- OAuth popup flow (not redirect) — trainer stays in FitRush
- Supabase Edge Function handles OAuth token exchange and storage
- Tokens stored encrypted in a new `google_calendar_connections` table
- Disconnect option with confirmation dialog
- Connection status indicator (Connected/Not Connected) with last sync time

### Booking → GCal event push
- When a booking is confirmed, create a Google Calendar event via GCal API
- Event includes: client name, session type, location, time, FitRush booking link
- Store GCal event ID on the booking record for future updates/deletion
- Edge Function `sync-booking-to-gcal` handles the API call
- Retry logic: 3 attempts with exponential backoff on GCal API failure

### External GCal → FitRush blocking
- Periodic sync (every 15 min via pg_cron or on-demand) pulls trainer's GCal events
- External events that overlap with FitRush availability slots mark those slots as blocked
- Blocked slots are NOT bookable (filtered from client-facing queries)
- Use Google Calendar push notifications (webhooks) for real-time sync if feasible, otherwise polling
- Store external events in a `gcal_blocked_slots` table

### Booking cancellation → GCal removal
- When a booking is cancelled, delete the corresponding GCal event
- Use the stored GCal event ID from the booking record
- Graceful handling: if GCal deletion fails, log error but don't block the cancellation

### iCal fallback
- Existing iCal export (Phase 19) continues working unchanged
- Trainers without Google Calendar connection see iCal as the primary option
- Both can coexist — iCal + GCal connected simultaneously

### Claude's Discretion
- Whether to use Google push notifications (webhooks) or polling for external event sync
- OAuth token refresh mechanism details
- How to handle trainers who revoke Google access externally
- Edge Function naming and structure
- gcal_blocked_slots table schema details

</decisions>

<canonical_refs>
## Canonical References

### Existing calendar infrastructure (Phase 19)
- `src/components/trainer/CalendarTab.tsx` — Existing iCal export UI
- `supabase/functions/` — Edge Function patterns

### OAuth patterns
- Google Calendar API docs — OAuth 2.0 for web server applications
- Supabase Edge Functions — Deno runtime for token exchange

### Database
- `.planning/REQUIREMENTS.md` — CALSYNC-01 through CALSYNC-05
- `bookings` table — needs `gcal_event_id` column

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CalendarTab.tsx — existing calendar settings UI, extend with Google connection
- Edge Function patterns from create-payment-intent, stripe-webhook
- Supabase auth for user context in Edge Functions

### Integration Points
- CalendarTab.tsx — add "Connect Google Calendar" section
- bookings table — add gcal_event_id column
- cancel-booking Edge Function — add GCal event deletion
- New Edge Functions: google-calendar-connect, sync-booking-to-gcal, sync-gcal-events

</code_context>

<specifics>
## Specific Ideas

- OAuth should feel seamless — popup, not a redirect that loses context
- Connection status should be clearly visible so trainers know it's working
- iCal stays as reliable fallback — Google Calendar is an enhancement, not a replacement

</specifics>

<deferred>
## Deferred Ideas

None — this is the final v4.0 phase

</deferred>

---

*Phase: 28-google-calendar-bidirectional-sync*
*Context gathered: 2026-03-19 via auto-mode*
