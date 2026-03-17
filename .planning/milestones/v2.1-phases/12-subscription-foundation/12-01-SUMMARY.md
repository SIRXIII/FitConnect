---
phase: 12-subscription-foundation
plan: "01"
subsystem: database
tags: [supabase, postgres, stripe, migrations, typescript, rls, triggers, rpc]

# Dependency graph
requires:
  - phase: 11-referral-program
    provides: profiles table with referral columns, availability_slots with deleted_at soft-delete pattern
  - phase: 10-earnings-analytics
    provides: trainer_profiles base schema, availability_slots schema confirmed
provides:
  - subscription_tier/subscription_status/stripe_customer_id columns on trainer_profiles
  - subscription_events table with UNIQUE constraint on stripe_event_id
  - guard_subscription_tier_write BEFORE UPDATE trigger blocking authenticated writes to billing columns
  - get_visible_slots RPC with tier-based slot limits (free=3, pro=10, elite=unlimited)
  - TypeScript types for all 10 new subscription columns and subscription_events table
affects:
  - 13-billing-backend
  - 14-feature-gates-search
  - 15-subscription-ui
  - 16-admin-subscription

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BEFORE UPDATE trigger as column-level write guard (RLS cannot restrict individual columns)
    - SECURITY DEFINER RPC for tier-gated queries that bypass restrictive anon RLS
    - ADD COLUMN IF NOT EXISTS for zero-impact idempotent migrations
    - INT max (2147483647) as unlimited LIMIT to avoid conditional LIMIT clause

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260316100000_subscription_foundation.sql"
  modified:
    - "Cenlar demand gt 1-17/src/types/supabase.ts"

key-decisions:
  - "BEFORE UPDATE trigger (not RLS) guards subscription columns — Supabase RLS has no column-level UPDATE restriction; trigger with IS DISTINCT FROM is the only enforceable mechanism"
  - "SECURITY DEFINER for get_visible_slots — anonymous clients need slot visibility; SECURITY INVOKER would be blocked by restrictive anon RLS on availability_slots"
  - "tier_overridden_by references profiles(id) ON DELETE SET NULL with timestamptz tier_overridden_at — authoritative schema per research file, not plan_split_guidance which had bool tier_override"
  - "Elite tier uses LIMIT 2147483647 — avoids conditional LIMIT clause complexity while being functionally unlimited"
  - "subscription_events insert only via service_role RLS policy — webhook Edge Functions write events; no direct client insert path"

patterns-established:
  - "Subscription column guard pattern: BEFORE UPDATE trigger + auth.role() = 'service_role' bypass + admin role bypass + billing column change detection"
  - "RPC tier-limit pattern: SELECT subscription_tier, CASE WHEN elite THEN maxint WHEN pro THEN N ELSE default END, LIMIT v_limit"

requirements-completed: [INFRA-12]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 12 Plan 01: Subscription Foundation Summary

**Locked subscription schema contract with 10 trainer_profiles columns, guard trigger blocking authenticated writes to billing fields, get_visible_slots RPC with tier-based limits, and subscription_events audit table — all applied to production Supabase**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T07:30:57Z
- **Completed:** 2026-03-16T07:32:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Applied idempotent migration adding 10 subscription columns to trainer_profiles with correct types, constraints (CHECK enums), and defaults
- Created subscription_events table with UNIQUE constraint on stripe_event_id and RLS policies (own/admin read, service_role insert)
- Established guard_subscription_tier_write BEFORE UPDATE trigger — authenticated users receive "Subscription fields can only be modified by the platform" exception; service_role and admin bypass
- Created get_visible_slots SECURITY DEFINER RPC returning tier-gated future unbooked slots (free=3, pro=10, elite=2147483647)
- Updated supabase.ts with all 10 new subscription columns across Row/Insert/Update and full subscription_events table block

## Task Commits

Each task was committed atomically:

1. **Task 1: Write and apply the subscription foundation migration** - `b779349` (feat)
2. **Task 2: Update TypeScript types for subscription columns** - `577d53a` (feat)

**Plan metadata:** committed with docs commit below

## Files Created/Modified
- `Cenlar demand gt 1-17/supabase/migrations/20260316100000_subscription_foundation.sql` - Full subscription DDL: ALTER TABLE trainer_profiles, CREATE TABLE subscription_events, guard trigger function, get_visible_slots RPC, RLS policies, indexes
- `Cenlar demand gt 1-17/src/types/supabase.ts` - Added 10 subscription columns to trainer_profiles Row/Insert/Update; added subscription_events table block

## Decisions Made
- Used `tier_overridden_by uuid REFERENCES public.profiles(id)` and `tier_overridden_at timestamptz` per research file — overrides the plan_split_guidance which incorrectly specified a bool `tier_override` column
- `get_visible_slots` uses `AND s.start_time > now()` filter to only return future slots — guards against stale slot data surfacing in UI
- Migration applied via `supabase db push` — required interactive confirmation (answered Y); migration applied with only expected NOTICE messages (DROP IF NOT EXISTS on new objects)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - `supabase db push` prompted for Y/n confirmation and applied cleanly. NOTICE messages for non-existent policies/trigger being dropped were expected on first run.

## User Setup Required

None - no external service configuration required. Migration applied directly to the linked Supabase project.

## Next Phase Readiness
- Schema contract locked — all 10 subscription columns, guard trigger, get_visible_slots RPC, and subscription_events table are live in production
- Phase 13 (Billing Backend) can now build Stripe webhook Edge Functions that write to these columns via service_role
- Phase 14 (Feature Gates + Search) can filter trainers by subscription_tier using the new indexed column
- Phase 15 (Subscription UI) can read subscription_tier/subscription_status to gate UI features
- Phase 16 (Admin Subscription) can use tier_overridden_by/tier_overridden_at for manual tier management; admin bypass in trigger is already wired

## Self-Check: PASSED

- FOUND: `Cenlar demand gt 1-17/supabase/migrations/20260316100000_subscription_foundation.sql`
- FOUND: `Cenlar demand gt 1-17/src/types/supabase.ts` (modified)
- FOUND: `.planning/phases/12-subscription-foundation/12-01-SUMMARY.md`
- FOUND: commit `b779349` (migration)
- FOUND: commit `577d53a` (TypeScript types)

---
*Phase: 12-subscription-foundation*
*Completed: 2026-03-16*
