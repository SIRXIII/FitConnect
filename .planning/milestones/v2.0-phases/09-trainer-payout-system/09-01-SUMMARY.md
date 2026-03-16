---
phase: 09-trainer-payout-system
plan: "01"
subsystem: payout-backend
tags: [stripe-transfers, supabase-edge-functions, resend, payout-system, database-migration]
dependency_graph:
  requires: []
  provides: [payout_transactions-table, create-payout-function, resend-email-delivery]
  affects: [payments-table, send-notification-email-function]
tech_stack:
  added: [npm:stripe@14.25.0, Resend API, payout_transactions table]
  patterns: [Deno.serve, service-role-admin-client, Stripe.createFetchHttpClient, Resend fetch POST]
key_files:
  created:
    - Cenlar demand gt 1-17/supabase/migrations/20260314200000_payout_system.sql
    - Cenlar demand gt 1-17/supabase/functions/create-payout/index.ts
  modified:
    - Cenlar demand gt 1-17/supabase/functions/send-notification-email/index.ts
decisions:
  - "Use Stripe transfers.create (not payouts.create) — transfers move funds to Connect account balance"
  - "Sweep payments.payout_transaction_id before Stripe call, rollback to NULL on failure"
  - "Email failure is non-blocking — payout completes even if Resend call fails"
  - "send-notification-email falls back to console.log when RESEND_API_KEY not set (dev mode)"
  - "Service role policies on payout_transactions allow Edge Function writes without trainer JWT"
metrics:
  duration: "~90 seconds"
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 9 Plan 01: Payout Backend Summary

**One-liner:** Payout backend with pg migration (payout_transactions table + payments FK), Stripe transfers.create Edge Function with $50 guard and duplicate prevention, and Resend API email delivery replacing the console.log stub.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Database migration — payout_transactions table and payments FK | 3f637f8 | supabase/migrations/20260314200000_payout_system.sql |
| 2 | create-payout Edge Function + Resend email integration | 2b93632 | supabase/functions/create-payout/index.ts, supabase/functions/send-notification-email/index.ts |

## What Was Built

### Task 1: Database Migration

- `payout_transactions` table with columns: `id`, `trainer_id` (FK to trainer_profiles with RESTRICT), `amount`, `stripe_transfer_id` (nullable), `status` (pending/processing/completed/failed), `initiated_by` (trainer/auto), `created_at`, `updated_at`
- `payments.payout_transaction_id` column added via ALTER TABLE with FK to payout_transactions ON DELETE SET NULL
- Two indexes: `idx_payout_transactions_trainer` (trainer_id, created_at DESC) and `idx_payments_payout_transaction`
- RLS enabled with SELECT policy for trainers (via trainer_profiles.user_id) and INSERT/UPDATE policies for service role

### Task 2: create-payout Edge Function

Full on-demand payout flow (290 lines):

1. JWT auth via userClient pattern from create-connect-account
2. Trainer profile lookup, stripe_account_id guard (400 if not connected)
3. Balance calculation: SUM(payments.trainer_payout) WHERE status='succeeded' AND payout_transaction_id IS NULL for trainer's bookings
4. $50 minimum guard (400)
5. Duplicate in-progress payout guard via maybeSingle() (409)
6. INSERT payout_transactions row (pending) → sweep payments.payout_transaction_id → stripe.transfers.create → UPDATE to processing
7. Rollback path: on Stripe failure, set payout status to 'failed', reset payments.payout_transaction_id to NULL; insufficient_funds returns 402, other Stripe errors return 502
8. Resend initiation email (non-blocking try/catch), fetches trainer email from profiles table
9. Returns `{ success: true, amount, transferId }`

### Task 2: send-notification-email Upgrade

- Replaced console.log stub with Resend API call (POST to api.resend.com/emails)
- Preserves full backwards compatibility with existing callers (same interface, same response format)
- Graceful dev-mode fallback: logs to console when RESEND_API_KEY not set
- Email failures log error but return success to caller (non-blocking)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files created, all commits verified:
- FOUND: Cenlar demand gt 1-17/supabase/migrations/20260314200000_payout_system.sql
- FOUND: Cenlar demand gt 1-17/supabase/functions/create-payout/index.ts
- FOUND: Cenlar demand gt 1-17/supabase/functions/send-notification-email/index.ts
- FOUND: commit 3f637f8 (migration)
- FOUND: commit 2b93632 (Edge Functions)
