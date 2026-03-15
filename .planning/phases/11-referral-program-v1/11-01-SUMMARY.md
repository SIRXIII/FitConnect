---
phase: 11-referral-program-v1
plan: "01"
subsystem: database
tags: [postgres, supabase, rls, rpc, cookies, typescript]

# Dependency graph
requires:
  - phase: 09-trainer-payout-system
    provides: payout_transactions table with initiated_by constraint

provides:
  - referrals table with self-referral CHECK, unique pair constraint, and RLS
  - referral_code column on profiles (unique 8-char, backfill + handle_new_user trigger)
  - referral_discount_pending and referral_discount_trainer_id columns on profiles
  - payout_transactions.initiated_by extended to include 'referral'
  - get_referral_leaderboard() RPC (top 10 rewarded referrers this calendar month)
  - src/lib/referral.ts cookie utility (captureReferralCode, readReferralCode, clearReferralCode, buildReferralLink)

affects:
  - 11-02 (landing page reads referral_code via captureReferralCode)
  - 11-03 (RoleSelect writes to referrals table using referral.ts helpers)
  - 11-04 (process-referral-reward Edge Function reads referrals table, writes payout credit with initiated_by = 'referral')

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SameSite=Lax cookie for referral attribution across OAuth redirects"
    - "Postgres ROW_NUMBER() OVER for leaderboard ranking in RPC (no client-side sort)"
    - "handle_new_user trigger generates referral_code inline with profile creation"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260316000000_referral_system.sql"
    - "Cenlar demand gt 1-17/src/lib/referral.ts"
  modified: []

key-decisions:
  - "SameSite=Lax (not Strict) for referral cookie — survives OAuth redirect round-trip"
  - "Leaderboard RPC uses date_trunc('month', now()) filter on rewarded_at for calendar month grouping"
  - "handle_new_user trigger updated inline — new signups get referral_code at profile creation, not at role-selection"
  - "RLS INSERT policy: referred_id = auth.uid() + referrer_id != auth.uid() — front-end attribution from RoleSelect"

patterns-established:
  - "Pattern: Cookie attribution — SameSite=Lax 30-day cookie named fitc_ref survives OAuth round-trips"
  - "Pattern: Referral leaderboard RPC — SECURITY INVOKER, STABLE, no auth required (public leaderboard)"

requirements-completed: [REFERRAL-01, REFERRAL-04, REFERRAL-05]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 11 Plan 01: Referral System Schema Summary

**Postgres referral schema with cookie attribution library — referrals table, referral_code column, leaderboard RPC, and SameSite=Lax cookie helpers for OAuth-compatible attribution**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T04:11:24Z
- **Completed:** 2026-03-15T04:12:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Complete referral DB schema in one migration: referral_code column with backfill, discount flags, updated payout constraint, referrals table with all safety constraints/indexes/RLS, leaderboard RPC
- Updated handle_new_user trigger so all new signups automatically get a unique 8-char referral_code
- Cookie utility library with all four functions typed correctly, using SameSite=Lax for OAuth compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Referral system DB migration** - `7aa59e8` (feat)
2. **Task 2: referral.ts cookie utility library** - `eee2619` (feat)

**Plan metadata:** (pending — docs commit)

## Files Created/Modified
- `Cenlar demand gt 1-17/supabase/migrations/20260316000000_referral_system.sql` - Full referral DB schema: referral_code + backfill, discount columns, payout constraint update, referrals table + RLS, leaderboard RPC, handle_new_user update
- `Cenlar demand gt 1-17/src/lib/referral.ts` - Browser cookie helpers: captureReferralCode, readReferralCode, clearReferralCode, buildReferralLink

## Decisions Made
- SameSite=Lax chosen over Strict — Lax cookies are sent on top-level cross-site navigations, which covers OAuth redirect returns; Strict would break attribution silently
- Leaderboard uses `date_trunc('month', now())` so the window resets at the calendar month boundary (not rolling 30 days)
- handle_new_user trigger updated in the migration rather than relying on application-level code — guarantees every new user gets a referral_code regardless of signup path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All downstream plans (11-02 through 11-04) can reference these schema objects and library exports
- Landing page (11-02) can import `captureReferralCode` from `@/lib/referral`
- RoleSelect (11-03) can read referral cookie and insert into `referrals` table
- process-referral-reward Edge Function (11-04) can write `payout_transactions` with `initiated_by = 'referral'`

---
*Phase: 11-referral-program-v1*
*Completed: 2026-03-15*
