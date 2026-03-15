---
phase: 11-referral-program-v1
plan: "02"
subsystem: api

tags: [supabase, edge-functions, deno, referrals, notifications, resend, payout]

# Dependency graph
requires:
  - phase: 11-referral-program-v1
    provides: "referrals table with status/rewarded_at columns and payout_transactions.initiated_by='referral' constraint (11-01)"
provides:
  - "process-referral-reward Edge Function: idempotent reward processing for trainer ($10 credit) and client ($5 discount) referral types"
affects:
  - 11-03-PLAN.md
  - 11-04-PLAN.md

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotency via status-guard UPDATE: .update({status:'rewarded'}).eq('status','pending').select('id') + array length check prevents double-reward on retries"
    - "Non-blocking Resend email: fetch().catch() pattern — reward completes even if email fails"
    - "First-booking trigger: count > 1 threshold (current booking already counted in aggregate)"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/functions/process-referral-reward/index.ts"
  modified: []

key-decisions:
  - "referral_discount_trainer_id set to null — $5 discount applies to ANY trainer booking, not only the referred trainer"
  - "Self-referral guard implemented at two levels: booking-level (client_id === trainer_id) and referral-row level (referrer_id === referred_id)"
  - "Reward fires only on first completed booking: count > 1 threshold because current completed booking is already included in count"
  - "Idempotency: status='rewarded' is written BEFORE payout/discount insert — if function retries after mark but before insert, the UPDATE returns 0 rows and the loop skips (safe)"

patterns-established:
  - "Edge Function idempotency pattern: claim ownership via status UPDATE with conditional WHERE clause before performing side effects"

requirements-completed: [REFERRAL-02, REFERRAL-03, REFERRAL-06]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 11 Plan 02: process-referral-reward Edge Function Summary

**Idempotent Deno Edge Function that processes $10 trainer payout credits and $5 client discount flags when a referred user completes their first booking, with in-app notifications and non-blocking Resend email**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-15T04:11:17Z
- **Completed:** 2026-03-15T04:16:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `process-referral-reward` Deno Edge Function with full idempotent reward logic
- Client-referral path: inserts `payout_transactions` row (amount=10, initiated_by='referral', status='completed') for referring trainer
- Trainer-referral path: sets `referral_discount_pending=true` and `referral_discount_trainer_id=null` on referring client's profile
- Both paths fire in-app notification (notifications table) and non-blocking Resend email

## Task Commits

Each task was committed atomically:

1. **Task 1: process-referral-reward Edge Function** - `d80e0cb` (feat)

## Files Created/Modified
- `Cenlar demand gt 1-17/supabase/functions/process-referral-reward/index.ts` - Reward engine Edge Function: handles both reward types with idempotency, first-booking guard, notifications, and email

## Decisions Made
- `referral_discount_trainer_id` set to `null` — discount is against any trainer per research recommendation, not locked to the referred trainer
- Self-referral guard applied at two layers: booking level (same user can't be both client and trainer) and referral row level (referrer_id === referred_id)
- Idempotency relies on `.eq('status', 'pending')` conditional UPDATE that returns 0 rows if already rewarded — safer than reading first then writing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `process-referral-reward` function is ready to be invoked from the TrainerBookings frontend when a trainer marks a session complete
- Plan 11-03 can wire the frontend call to invoke this function after booking status update
- Plan 11-04 can build the referral link sharing UI and tracking

---
*Phase: 11-referral-program-v1*
*Completed: 2026-03-15*
