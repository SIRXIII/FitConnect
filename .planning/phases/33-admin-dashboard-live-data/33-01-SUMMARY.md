---
phase: 33-admin-dashboard-live-data
plan: 01
subsystem: database
tags: [postgres, rls, rpc, security-definer, supabase, payout, admin]

# Dependency graph
requires:
  - phase: 09-payout-system
    provides: payout_transactions table with trainer RLS and service-role policies
  - phase: 05-admin-role
    provides: admin role in profiles, admin RLS patterns on bookings/payments/trainer_profiles

provides:
  - Admin RLS policies on payout_transactions (SELECT, INSERT, UPDATE)
  - held status added to payout_transactions check constraint
  - get_admin_user_list() SECURITY DEFINER RPC joining auth.users for email/last_sign_in_at
  - get_admin_payout_balances() SECURITY DEFINER RPC aggregating pending balances per trainer
  - Admin bypass in create-payout edge function via optional trainer_id body param

affects:
  - 33-admin-dashboard-live-data (plans 02 and 03 — UI depends on these RPCs and policies)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SECURITY DEFINER RPC with admin role guard (same pattern as get_admin_analytics)
    - Admin bypass in edge function via optional body param + role check + 403 guard
    - held status on payout_transactions for admin-held payouts

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260323000000_admin_dashboard_live_data.sql"
  modified:
    - "Cenlar demand gt 1-17/supabase/functions/create-payout/index.ts"

key-decisions:
  - "Admin payout bypass uses optional trainer_id body param (not a header) — consistent with other edge function patterns"
  - "held status added to payout_transactions to support future admin hold workflow"
  - "get_admin_user_list joins auth.users directly via SECURITY DEFINER — only safe path to email/last_sign_in_at without exposing auth schema to RLS policies"

patterns-established:
  - "SECURITY DEFINER RPC pattern: SELECT role INTO v_role; IF v_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION"
  - "Admin edge function bypass: parse body.trainer_id, check callerProfile.role === 'admin', 403 if not, override trainerUserId"

requirements-completed: [ADMIN-01, ADMIN-03, ADMIN-06]

# Metrics
duration: 12min
completed: 2026-03-23
---

# Phase 33 Plan 01: Admin Dashboard Live Data (Database Layer) Summary

**Admin RLS policies, held status, and two SECURITY DEFINER RPCs (get_admin_user_list, get_admin_payout_balances) enabling admin dashboard live data; create-payout edge function extended with admin-bypass trainer_id parameter**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-23T00:00:00Z
- **Completed:** 2026-03-23T00:12:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Admin can now query all payout_transactions via RLS (SELECT, INSERT, UPDATE policies)
- get_admin_user_list() RPC exposes auth.users email and last_sign_in_at via SECURITY DEFINER join — inaccessible via normal RLS
- get_admin_payout_balances() RPC aggregates pending payout balance per trainer (succeeded payments not yet swept into a payout transaction)
- create-payout edge function accepts optional trainer_id body param; validates admin role, returns 403 to non-admins, and routes payout to target trainer

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin dashboard migration with RLS policies and RPCs** - `b5d17ff` (feat)
2. **Task 2: Add admin bypass parameter to create-payout edge function** - `831aa85` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `Cenlar demand gt 1-17/supabase/migrations/20260323000000_admin_dashboard_live_data.sql` - Admin RLS on payout_transactions, held status constraint, get_admin_user_list RPC, get_admin_payout_balances RPC, NOTIFY pgrst
- `Cenlar demand gt 1-17/supabase/functions/create-payout/index.ts` - Admin bypass: parse body.trainer_id, check admin role, 403 guard, trainerUserId override

## Decisions Made

- Admin payout bypass uses optional `trainer_id` body param rather than a header — consistent with how other edge functions accept parameters and avoids custom header CORS complexity.
- `held` status added to payout_transactions check constraint to support a future admin hold workflow (flagged as needed by admin dashboard plans 02/03).
- `get_admin_user_list` joins `auth.users` via SECURITY DEFINER — the only safe path to expose `email` and `last_sign_in_at` without widening RLS on the auth schema itself.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration must be applied to the Supabase project via `supabase db push` or Supabase dashboard SQL editor.

## Next Phase Readiness

- Database layer is fully ready for admin dashboard UI plans 02 and 03
- get_admin_user_list and get_admin_payout_balances RPCs can be called from the admin UI via `supabase.rpc('get_admin_user_list')` and `supabase.rpc('get_admin_payout_balances')`
- Admin-triggered payouts can be initiated by POSTing `{ trainer_id: "<user_id>" }` to the create-payout edge function with an admin auth token

---
*Phase: 33-admin-dashboard-live-data*
*Completed: 2026-03-23*
