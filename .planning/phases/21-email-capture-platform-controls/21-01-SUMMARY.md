---
phase: 21-email-capture-platform-controls
plan: "01"
subsystem: waitlist-backend
tags: [waitlist, edge-function, supabase, resend, zod, migration]
dependency_graph:
  requires: []
  provides: [email_subscribers-table, waitlist-signup-edge-function, waitlistSchema]
  affects: [schemas.ts, supabase-migrations, supabase-functions]
tech_stack:
  added: [waitlist-signup edge function]
  patterns: [service-role-bypass-rls, silent-duplicate-200, non-fatal-email]
key_files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260318200000_email_subscribers.sql"
    - "Cenlar demand gt 1-17/supabase/functions/waitlist-signup/index.ts"
  modified:
    - "Cenlar demand gt 1-17/src/lib/schemas.ts"
decisions:
  - "Silent 200 on duplicate email (23505) to prevent enumeration attacks"
  - "Service-role key for DB insert to bypass RLS without anon policy"
  - "Resend email failure is non-fatal — insert success always returns 200"
metrics:
  duration: "126s"
  completed: "2026-03-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 21 Plan 01: Waitlist Backend Summary

**One-liner:** Email waitlist backend with migration, service-role Edge Function, and Zod schema — Resend confirmation email non-fatal, duplicates silently succeed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create email_subscribers migration and waitlistSchema | 6c43582 | migrations/20260318200000_email_subscribers.sql, src/lib/schemas.ts |
| 2 | Create waitlist-signup Edge Function | 49b96d1 | supabase/functions/waitlist-signup/index.ts |

## What Was Built

### email_subscribers Migration
- `public.email_subscribers` table with `id` (uuid PK), `email` (text NOT NULL), `created_at` (timestamptz)
- Case-insensitive unique index on `lower(email)` — prevents `User@example.com` and `user@example.com` from both inserting
- RLS enabled with no public policies — INSERT via service-role key in Edge Function, no anon SELECT

### waitlist-signup Edge Function
- Public endpoint: no `Authorization` header check — intended for unauthenticated visitors
- Server-side email validation via regex before touching the database
- Creates Supabase client with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for insert
- PostgreSQL error code `23505` (unique violation) returns `{ success: true }` with HTTP 200 — prevents email enumeration
- Sends branded confirmation email via Resend (`FitRush <noreply@resend.dev>`) with gold `#C5A059` accent
- If `RESEND_API_KEY` is absent: logs and skips email (dev mode safe)
- Email send failure is non-fatal: `console.error` logged, insert result still returned as success
- CORS preflight handled, non-POST returns 405

### waitlistSchema (schemas.ts)
- Appended to end of `schemas.ts` under Phase 21 section header
- Validates `email`: required, max 320 chars, must be valid email format
- Exports `WaitlistInput` type via `z.infer`
- Zero modifications to existing schemas

## Verification

- `grep -n "waitlistSchema"` and `grep -n "WaitlistInput"` confirm exports present
- `grep -n "email_subscribers"` confirms migration DDL correct
- `grep -n "23505"` and `grep -n "SUPABASE_SERVICE_ROLE_KEY"` confirm Edge Function correctness
- `npx vitest run`: 54 passing, 2 pre-existing failures (missing Supabase env var, UI grid layout test) — no regressions from plan changes

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

Two test failures existed before this plan and are unrelated to the changes:
1. `src/hooks/useTrainers.test.ts` — fails due to missing `VITE_SUPABASE_URL` env var
2. `src/pages/AdminDashboard.test.tsx` — UI grid layout assertion mismatch (pre-existing)

Both logged to `deferred-items.md` scope for future fix.
