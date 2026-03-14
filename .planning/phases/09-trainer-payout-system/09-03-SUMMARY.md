---
phase: 09-trainer-payout-system
plan: "03"
subsystem: payout-backend
tags: [pg-cron, pg-net, stripe-transfers, supabase-vault, resend, edge-functions, webhooks]

dependency_graph:
  requires:
    - phase: 09-01
      provides: payout_transactions table, create-payout Edge Function, Resend email pattern
  provides:
    - weekly-payouts Edge Function (auto-payout for all eligible trainers)
    - pg_cron migration (Monday 09:00 UTC schedule via net.http_post + Vault)
    - payout.paid webhook handler (completion email + status update)
  affects: [earnings-analytics, stripe-connect]

tech-stack:
  added: [pg_cron, pg_net, supabase-vault]
  patterns:
    - pg_cron + net.http_post + Vault pattern for scheduled Edge Function calls
    - Service-role token validation (token === SUPABASE_SERVICE_ROLE_KEY) for system functions
    - Connected account event handling via event.account field in stripe-webhook
    - Concurrent-payout ambiguity guard (skip if processingTxns.length > 1)

key-files:
  created:
    - Cenlar demand gt 1-17/supabase/functions/weekly-payouts/index.ts
    - Cenlar demand gt 1-17/supabase/migrations/20260314210000_weekly_payout_cron.sql
  modified:
    - Cenlar demand gt 1-17/supabase/functions/stripe-webhook/index.ts

key-decisions:
  - "Service-role auth for weekly-payouts: validate token === SUPABASE_SERVICE_ROLE_KEY (system function, not user-facing)"
  - "Recalculate exact balance per trainer at execution time (race-condition safe — aggregate then reconfirm)"
  - "payout.paid ambiguity guard: skip completion if multiple processing transactions exist (log + defer vs. mark wrong tx)"
  - "Vault secrets NOT in migration file — comments document manual setup, secrets read at runtime via vault.decrypted_secrets"
  - "Email failures non-blocking in both weekly-payouts and payout.paid handler"

patterns-established:
  - "System Edge Function pattern: no user JWT, validate service role token directly, return { processed, failed }"
  - "Vault-backed pg_cron: SELECT net.http_post(url := (SELECT decrypted_secret ...), headers := ...) for safe secret injection"

requirements-completed: [PAYOUT-03, PAYOUT-06]

duration: ~2min
completed: 2026-03-14
---

# Phase 9 Plan 03: Weekly Auto-Payout + Completion Webhook Summary

**pg_cron-scheduled weekly-payouts Edge Function iterating all trainers with balance >= $50, plus payout.paid webhook handler that marks transactions completed and sends arrival emails via Resend.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-14T23:48:10Z
- **Completed:** 2026-03-14T23:50:11Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Weekly auto-payout Edge Function processes all eligible trainers with $50+ balance every Monday at 09:00 UTC
- pg_cron migration uses official Supabase pattern: `cron.schedule` + `net.http_post` + Vault for secret injection
- payout.paid webhook case safely marks payout_transactions completed with concurrent-payout ambiguity guard
- Completion email "Your FitRush payout has arrived" sent via Resend when funds arrive in trainer's bank

## Task Commits

Each task was committed atomically:

1. **Task 1: weekly-payouts Edge Function + pg_cron migration** - `977f1a1` (feat)
2. **Task 2: payout.paid webhook handler for completion email** - `d5682de` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `Cenlar demand gt 1-17/supabase/functions/weekly-payouts/index.ts` - Auto-payout system Edge Function; service-role auth, eligible trainer iteration, Stripe transfers, rollback on failure, non-blocking initiation email
- `Cenlar demand gt 1-17/supabase/migrations/20260314210000_weekly_payout_cron.sql` - pg_cron schedule (Monday 09:00 UTC) calling weekly-payouts via net.http_post with Vault credentials; includes manual Vault setup instructions
- `Cenlar demand gt 1-17/supabase/functions/stripe-webhook/index.ts` - Added payout.paid case: finds trainer by stripe_account_id, guards concurrent processing transactions, marks completed, sends arrival email

## Decisions Made

- **Service-role auth pattern:** weekly-payouts validates the Authorization Bearer token directly against `SUPABASE_SERVICE_ROLE_KEY`. No user JWT needed — this is a system function called only by pg_cron.
- **Race-condition-safe balance calculation:** aggregate eligible trainers first, then recalculate exact balance per trainer at execution time before inserting payout_transactions. Prevents stale data from the aggregation phase.
- **payout.paid ambiguity guard:** Stripe payouts bundle multiple transfers into one bank deposit. No 1:1 mapping is available in the event. If `processingTxns.length > 1` for a trainer, we log a warning and skip rather than risk marking the wrong transaction as completed.
- **Vault secrets in migration comments only:** The migration file contains only placeholder text (`YOUR_PROJECT_REF`) in comments. Real secrets are read at runtime from `vault.decrypted_secrets`. This follows Supabase security guidance.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Three external configuration steps are required before this plan's features work in production:

**1. Supabase Vault secrets (required for pg_cron):**
Run in Supabase SQL Editor after deploying the migration:
```sql
SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

**2. Stripe webhook — Connect events (required for payout.paid):**
- Stripe Dashboard -> Developers -> Webhooks -> your endpoint
- Enable "Listen to events on Connected accounts"
- Add `payout.paid` event type

**3. Resend API key (required for emails):**
```bash
supabase secrets set RESEND_API_KEY=re_...
```
Source: Resend Dashboard -> API Keys -> Create API Key

## Next Phase Readiness

- Payout system is complete end-to-end: on-demand (09-01), auto-weekly (09-03), completion notification (09-03)
- Phase 9 Plan 02 (payout UI) can proceed independently — backend is ready
- Phase 10 (Earnings Analytics) can proceed — payout_transactions table has all required data

## Self-Check: PASSED

All files created and commits verified:
- FOUND: Cenlar demand gt 1-17/supabase/functions/weekly-payouts/index.ts
- FOUND: Cenlar demand gt 1-17/supabase/migrations/20260314210000_weekly_payout_cron.sql
- FOUND: Cenlar demand gt 1-17/supabase/functions/stripe-webhook/index.ts
- FOUND: .planning/phases/09-trainer-payout-system/09-03-SUMMARY.md
- FOUND: commit 977f1a1 (weekly-payouts Edge Function + pg_cron migration)
- FOUND: commit d5682de (payout.paid webhook handler)

---
*Phase: 09-trainer-payout-system*
*Completed: 2026-03-14*
