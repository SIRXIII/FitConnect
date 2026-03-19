---
phase: 22-availability-toggle-foundation
plan: "01"
subsystem: database
tags: [sql-migration, supabase, typescript-types, test-scaffolds, availability-toggle, atomic-rpc, pg-cron]
dependency_graph:
  requires: []
  provides:
    - "20260319000000_availability_toggle.sql — all DB schema for phase 22"
    - "trainer_profiles.availability_status + booking_mode + sleep_timer_expires_at + availability_session_started_at"
    - "booking_requests table with RLS + Realtime"
    - "create_booking_atomic RPC with SELECT...FOR UPDATE"
    - "expire_stale_availability function + pg_cron job"
    - "supabase.ts types for all new DB objects"
    - "useAvailabilitySession.test.ts scaffold (AVAIL-01, AVAIL-02)"
    - "BookSession.test.ts scaffold (AVAIL-04)"
  affects:
    - "plan 02 — AvailabilityHeader + LiveToggle UI (depends on trainer_profiles columns)"
    - "plan 03 — BookSession.tsx RPC integration (depends on create_booking_atomic + BookSession.test.ts)"
tech_stack:
  added: []
  patterns:
    - "SELECT...FOR UPDATE row-level locking in PL/pgSQL SECURITY DEFINER function"
    - "pg_cron with graceful DO $$ IF EXISTS fallback for unavailable extension"
    - "Conditional Realtime publication (DO $$ IF NOT EXISTS $$) — idempotent migration"
key_files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260319000000_availability_toggle.sql"
    - "Cenlar demand gt 1-17/src/hooks/useAvailabilitySession.test.ts"
    - "Cenlar demand gt 1-17/src/pages/BookSession.test.ts"
  modified:
    - "Cenlar demand gt 1-17/src/types/supabase.ts"
decisions:
  - "[22-01] pg_cron scheduled with graceful DO $$ IF EXISTS $$ fallback — migration won't fail on Free plan, just logs RAISE NOTICE"
  - "[22-01] booking_requests inserted after bookings in supabase.ts — maintains alphabetical grouping by domain"
  - "[22-01] expire_stale_availability auto-declines pending requests in two passes: first for trainers who just went offline, then for 30-minute timeout — order matters (offline check must run after trainer_profiles UPDATE)"
metrics:
  duration_seconds: 146
  completed_date: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 22 Plan 01: Availability Toggle Foundation Summary

**One-liner:** PostgreSQL migration with atomic booking RPC (SELECT...FOR UPDATE), booking_requests table + RLS, stale session expiry via pg_cron, and TypeScript type sync + test scaffolds for availability toggle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SQL migration — columns, tables, RPC, pg_cron | 8cd49e0 | supabase/migrations/20260319000000_availability_toggle.sql |
| 2 | Update TypeScript types + create test scaffolds | 9c57717 | src/types/supabase.ts, src/hooks/useAvailabilitySession.test.ts, src/pages/BookSession.test.ts |

## What Was Built

### Migration (20260319000000_availability_toggle.sql)

Four new columns on `trainer_profiles`:
- `availability_status text NOT NULL DEFAULT 'offline' CHECK (IN ('offline', 'live'))`
- `booking_mode text NOT NULL DEFAULT 'instant' CHECK (IN ('instant', 'request'))`
- `sleep_timer_expires_at timestamptz`
- `availability_session_started_at timestamptz`

New `booking_requests` table with 3 RLS policies (trainer-all, client-select, client-insert) and Realtime publication.

`create_booking_atomic` PL/pgSQL SECURITY DEFINER function:
- Locks slot row with `SELECT ... FOR UPDATE`
- Returns `{ error: 'slot_taken' }` when `is_booked = true`
- Returns `{ error: 'slot_not_found' }` when slot doesn't exist
- Returns `{ booking_id: uuid }` on success

`expire_stale_availability` function handles:
- Sleep timer expiry (`sleep_timer_expires_at < now()`)
- 12-hour hard cap (`availability_session_started_at < now() - INTERVAL '12 hours'`)
- Auto-decline pending requests for offline trainers
- Auto-decline requests past 30-minute timeout

pg_cron job `expire-stale-availability` runs every 5 minutes with `IF EXISTS (pg_extension)` guard.

Idempotent Realtime publication guards for `availability_slots` and `trainer_profiles`.

### TypeScript Types (supabase.ts)

Added to `trainer_profiles` Row/Insert/Update: 4 new fields matching migration columns.

Added `booking_requests` table definition with Row/Insert/Update types after `bookings` block.

### Test Scaffolds

`useAvailabilitySession.test.ts` — 5 tests passing:
- Countdown math: hours/minutes computation from ISO timestamp
- Countdown math: returns 0 for past timestamps
- EOD: resolves to 23:59:59 local
- State machine: offline -> going_live -> live transition
- State machine: cancel during warm-up returns to offline

`BookSession.test.ts` — 4 tests passing:
- RPC called with correct `create_booking_atomic` params
- Handles `slot_taken` error
- Handles `slot_not_found` error
- Returns `booking_id` on success

## Verification

- All acceptance criteria passed via grep checks
- 9 new tests pass: `vitest run` exits 0 for both scaffold files
- TypeScript: no new errors introduced (pre-existing errors in unrelated files confirmed pre-existing)
- Pre-existing `AdminDashboard.test.tsx` failure (1 test) confirmed unrelated to this plan

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files confirmed:
- FOUND: Cenlar demand gt 1-17/supabase/migrations/20260319000000_availability_toggle.sql
- FOUND: Cenlar demand gt 1-17/src/types/supabase.ts (modified)
- FOUND: Cenlar demand gt 1-17/src/hooks/useAvailabilitySession.test.ts
- FOUND: Cenlar demand gt 1-17/src/pages/BookSession.test.ts

Commits confirmed:
- 8cd49e0 — feat(22-01): SQL migration — availability toggle foundation
- 9c57717 — feat(22-01): update TypeScript types + create test scaffolds
