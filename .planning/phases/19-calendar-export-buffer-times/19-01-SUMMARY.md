---
phase: 19-calendar-export-buffer-times
plan: 01
subsystem: database
tags: [postgres, supabase, zod, calendar, migration]

requires:
  - phase: 16-subscription-tiers
    provides: trainer_profiles table with subscription columns
provides:
  - calendar_export_token column on trainer_profiles
  - buffer_minutes column on trainer_profiles with CHECK constraint
  - reset_calendar_export_token() RPC
  - bufferTimeSchema and BUFFER_OPTIONS Zod validation
  - BufferTimeInput TypeScript type
affects: [19-02, 19-03, 19-04]

tech-stack:
  added: []
  patterns: [ADD COLUMN IF NOT EXISTS for idempotent migrations, SECURITY DEFINER RPC with search_path]

key-files:
  created:
    - Cenlar demand gt 1-17/supabase/migrations/20260318100000_calendar_buffer.sql
  modified:
    - Cenlar demand gt 1-17/src/lib/schemas.ts

key-decisions:
  - "Used gen_random_uuid()::text as default for calendar_export_token (no extra dependency)"
  - "Partial unique index WHERE NOT NULL on calendar_export_token"
  - "SECURITY DEFINER with explicit search_path on reset RPC"

patterns-established:
  - "Calendar token pattern: UUID text column with partial unique index"

requirements-completed: [CAL-03, CAL-04, CAL-05, CAL-06]

duration: 3min
completed: 2026-03-18
---

# Phase 19 Plan 01: Database Foundation Summary

**Calendar export token and buffer minutes columns with reset RPC and Zod validation schema**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T01:20:20Z
- **Completed:** 2026-03-18T01:23:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Migration adds calendar_export_token (text, unique, auto-generated UUID) to trainer_profiles
- Migration adds buffer_minutes (smallint, CHECK 0/15/30/45/60) to trainer_profiles
- reset_calendar_export_token() RPC allows trainers to rotate their calendar token
- bufferTimeSchema with BUFFER_OPTIONS const for client-side validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create calendar buffer migration** - `4a987ab` (feat)
2. **Task 2: Add bufferTimeSchema to Zod schemas** - `3d6a03c` (feat)

## Files Created/Modified
- `Cenlar demand gt 1-17/supabase/migrations/20260318100000_calendar_buffer.sql` - Migration with columns, backfill, RPC, and GRANT
- `Cenlar demand gt 1-17/src/lib/schemas.ts` - Added BUFFER_OPTIONS, bufferTimeSchema, BufferTimeInput type

## Decisions Made
- Used gen_random_uuid()::text as default for calendar_export_token (Postgres built-in, no dependencies)
- Partial unique index (WHERE NOT NULL) to allow flexibility if needed
- SECURITY DEFINER with explicit search_path = public on reset RPC for security

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Database columns ready for Plan 02 (iCal feed endpoint using calendar_export_token)
- Zod schema ready for Plan 03 (buffer time UI settings)
- No blockers

---
*Phase: 19-calendar-export-buffer-times*
*Completed: 2026-03-18*
