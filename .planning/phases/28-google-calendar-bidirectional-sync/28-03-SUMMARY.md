---
phase: 28-google-calendar-bidirectional-sync
plan: "03"
subsystem: edge-functions
tags: [google-calendar, sync, edge-functions, bookings, availability]
dependency_graph:
  requires: ["28-01"]
  provides: ["sync-booking-to-gcal", "sync-gcal-events", "cancel-booking-gcal-deletion"]
  affects: ["bookings.gcal_event_id", "gcal_blocked_slots", "availability_slots.is_gcal_blocked"]
tech_stack:
  added: []
  patterns:
    - "Best-effort async side-effect pattern: GCal deletion wrapped in try/catch after core operation"
    - "Service-role vs user auth dual-path detection via Authorization header comparison"
    - "Per-iteration try/catch loop for batch processing (one failure doesn't stop others)"
key_files:
  created:
    - "Cenlar demand gt 1-17/supabase/functions/sync-booking-to-gcal/index.ts"
    - "Cenlar demand gt 1-17/supabase/functions/sync-gcal-events/index.ts"
  modified:
    - "Cenlar demand gt 1-17/supabase/functions/cancel-booking/index.ts"
decisions:
  - "GCal deletion on cancellation is best-effort (non-blocking) — cancellation never fails due to GCal"
  - "sync-gcal-events accepts both service-role (pg_cron) and user auth (manual sync) in one function"
  - "All-day GCal events filtered out — only timed events (start.dateTime) block availability slots"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_modified: 3
---

# Phase 28 Plan 03: GCal Sync Edge Functions Summary

**One-liner:** Three Edge Functions implementing bidirectional GCal sync: outbound booking push, inbound external event polling with availability blocking, and best-effort cancellation cleanup.

## What Was Built

### Task 1: sync-booking-to-gcal Edge Function
Pushes confirmed/pending bookings to the trainer's Google Calendar as events. Accepts both service-role auth (for automated triggers post-booking) and user auth. Creates events tagged with `source=fitrush` via the `createGcalEvent` helper (Pitfall 4 prevention). Stores the returned event ID as `bookings.gcal_event_id` for later deletion. Uses `withRetry` for 3-attempt exponential backoff. Silently skips trainers with no active GCal connection, bookings not in a syncable state, and already-synced bookings (idempotent).

### Task 2: sync-gcal-events Edge Function
Polls external Google Calendar events for all active GCal connections (service-role/pg_cron path) or a single trainer's connection (user auth path). Filters FitRush-tagged events using `listGcalEvents` helper's `privateExtendedProperty=source!=fitrush` filter. Skips all-day events (only `start.dateTime` events block slots). Upserts external events into `gcal_blocked_slots`, cleans up past entries, then calls the `apply_gcal_blocks` RPC to mark overlapping `availability_slots.is_gcal_blocked`. Updates `last_sync_at` on the connection. Per-trainer try/catch ensures one failure never stops the batch.

### Task 3: cancel-booking GCal Extension
Extended the existing cancel-booking Edge Function with best-effort GCal event deletion after successful cancellation. Added `gcal_event_id` to the booking SELECT query and a post-cancellation try/catch block that fetches the trainer's active connection, refreshes the token if needed, and deletes the event. GCal deletion failure is logged but never blocks the cancellation response. All existing Stripe refund, 24-hour policy, auth, and error handling logic is unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `9d4a39f` feat(28-03): sync-booking-to-gcal Edge Function for outbound booking push
- `f45cd7a` feat(28-03): sync-gcal-events Edge Function for inbound external event polling
- `621fffe` feat(28-03): extend cancel-booking to delete GCal event on cancellation

## Self-Check: PASSED
