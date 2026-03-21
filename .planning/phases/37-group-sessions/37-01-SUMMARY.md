---
phase: 37-group-sessions
plan: "01"
subsystem: availability
tags: [group-sessions, schema, availability, trainer-dashboard]
dependency_graph:
  requires: []
  provides: [group-session-schema, group-slot-creation-ui]
  affects: [availability_slots, TrainerDashboard, BookSession]
tech_stack:
  added: []
  patterns: [additive-migration, conditional-form-fields]
key_files:
  created:
    - supabase/migrations/20260320_group_sessions.sql
  modified:
    - src/types/supabase.ts
    - src/hooks/useAvailability.ts
    - src/components/trainer/AvailabilityManager.tsx
decisions:
  - "Group slot creation uses a dedicated form section (not grid click) since capacity/rate params require more input than a single cell click can express"
  - "Calendar grid cells for group slots are read-only (blue highlight) — removal handled via manage bookings"
metrics:
  duration_seconds: 133
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 4
---

# Phase 37 Plan 01: Group Sessions Schema + Creation UI Summary

Group session schema migration and trainer-side slot creation UI. Trainers can now create group slots specifying capacity (2-10) and per-person rate, with all existing individual slot functionality preserved.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Schema migration for group slots | 594a18e | supabase/migrations/20260320_group_sessions.sql |
| 2 | Group slot creation UI in trainer dashboard | bcefa1c | src/types/supabase.ts, src/hooks/useAvailability.ts, src/components/trainer/AvailabilityManager.tsx |

## What Was Built

### Schema (20260320_group_sessions.sql)
- `slot_type TEXT DEFAULT 'individual'` with CHECK constraint (individual|group)
- `max_capacity INTEGER` with CHECK (NULL or 2-10)
- `group_rate NUMERIC(10,2)` for per-person pricing
- Constraint `group_slot_requires_capacity` ensuring group slots always have both max_capacity and group_rate
- `get_slot_booking_count(p_slot_id UUID)` RPC returning confirmed+pending booking count
- `is_group_slot_available(p_slot_id UUID)` RPC for capacity checks

### TypeScript Types
- `AvailabilitySlot` (via `Tables<'availability_slots'>`) updated with `slot_type`, `max_capacity`, `group_rate` in Row/Insert/Update

### useAvailability Hook
- `addSlot()` extended with optional `options` parameter `{ slot_type?, max_capacity?, group_rate? }`
- Individual slots remain unchanged (default behavior)

### AvailabilityManager UI
- Added collapsible "Add Group Session" panel with form fields: date, start/end hour, max participants (2-10), per-person rate
- Calendar grid shows group slots with blue highlight (non-interactive, read-only)
- Legend updated with group session indicator
- Individual slot grid click behavior fully preserved

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Design note:** The plan referenced `SlotCreationForm.tsx` but the actual slot creation is handled inline in `AvailabilityManager.tsx` (the grid). Rather than creating a separate file, the group slot form was added as a collapsible section within AvailabilityManager, which matches the existing architecture pattern.

## Self-Check: PASSED
- `supabase/migrations/20260320_group_sessions.sql` exists
- Commits 594a18e and bcefa1c exist in git log
- TypeScript errors in changed files: 0 (all pre-existing errors in unrelated files)
