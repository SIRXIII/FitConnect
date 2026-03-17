---
phase: 13-billing-backend
plan: "01"
subsystem: payments
tags: [stripe, supabase, edge-functions, webhooks, subscriptions, deno]

requires:
  - phase: 12-subscription-foundation
    provides: trainer_profiles subscription columns, subscription_events idempotency table, STRIPE_BILLING_WEBHOOK_SECRET env var

provides:
  - stripe-billing-webhook Edge Function handling all 6 Stripe billing event types
  - Idempotency via subscription_events unique stripe_event_id (23505 guard)
  - Subscription tier/status sync on subscription create/update/delete
  - Trial-end email trigger via Resend (non-blocking)
  - Payment failure downgrade guard (active-only, BILL-07)

affects:
  - 13-02 (create-subscription calls into same trainer_profiles columns)
  - 14-feature-gates (reads subscription_tier written by this webhook)
  - 15-subscription-ui (subscription_status/tier displayed to trainer)

tech-stack:
  added: []
  patterns:
    - "req.text() (not req.json()) before stripe.webhooks.constructEvent to preserve HMAC body"
    - "TIER_FROM_PRICE price-ID map for tier derivation without hardcoded conditionals"
    - "resolveTrainer by stripe_customer_id — webhook events never contain trainer UUID directly"
    - "recordEvent returns raw error; caller checks error.code === '23505' for idempotency"
    - "Non-blocking email: fire-and-forget fetch with .catch(console.error)"
    - "Active-only downgrade guard: check trainer.subscription_status before writing past_due"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/functions/stripe-billing-webhook/index.ts"
  modified: []

key-decisions:
  - "Uses STRIPE_BILLING_WEBHOOK_SECRET not STRIPE_WEBHOOK_SECRET — separate endpoint, separate signing secret"
  - "Unknown stripe_customer_id returns 200 (not 4xx) to prevent Stripe infinite retry loop"
  - "invoice.payment_failed skips trialing trainers — customer.subscription.deleted fires when trial exhausts"
  - "trial_will_end does no DB write — email-only event, subscription state unchanged"
  - "APP_URL env var for portal link with fallback to hardcoded app.fitrush.io URL"

patterns-established:
  - "Billing webhook pattern: resolveTrainer → recordEvent (23505 check) → DB update → return 200"
  - "All trainer_profiles billing writes use .eq('stripe_customer_id', customerId), never by UUID"

requirements-completed: [BILL-02, BILL-06, BILL-07, BILL-08]

duration: 1min
completed: 2026-03-16
---

# Phase 13 Plan 01: Stripe Billing Webhook Summary

**Deno Edge Function handling 6 Stripe billing events with idempotency, trial-end emails, and active-only payment-failure downgrade guard**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-16T21:14:02Z
- **Completed:** 2026-03-16T21:15:00Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Deployed `stripe-billing-webhook` Edge Function to Supabase project (ACTIVE, v1)
- All 6 Stripe billing event handlers implemented with full idempotency via `subscription_events` 23505 guard
- BILL-07 payment-failure guard: only downgrades `subscription_status='active'` trainers; trialing trainers are unaffected
- BILL-08 trial-end email: non-blocking Resend call, skips gracefully if `RESEND_API_KEY` absent

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stripe-billing-webhook Edge Function with all 6 event handlers** - `a9276e3` (feat)

## Files Created/Modified

- `Cenlar demand gt 1-17/supabase/functions/stripe-billing-webhook/index.ts` - Full billing webhook handler: subscription create/update/delete/trial_will_end, invoice.paid/payment_failed

## Decisions Made

- Used `STRIPE_BILLING_WEBHOOK_SECRET` (not `STRIPE_WEBHOOK_SECRET`) — separate Stripe endpoint with its own `whsec_` signing secret, prevents cross-event contamination
- Unknown `stripe_customer_id` → return 200 (not 4xx) — prevents Stripe from retrying indefinitely for non-trainer customers (e.g., test mode customers)
- `invoice.payment_failed` skips trainers in `trialing` status — `customer.subscription.deleted` fires after trial exhaustion, which is the authoritative downgrade path
- `trial_will_end` is email-only with no DB write — subscription state is already correct; only notification is needed
- `APP_URL` env var for portal link with fallback to `https://app.fitrush.io/trainer/dashboard?tab=subscription`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — `STRIPE_BILLING_WEBHOOK_SECRET` was confirmed set in Phase 12. `RESEND_API_KEY` and `APP_URL` are optional; function degrades gracefully when absent.

## Next Phase Readiness

- `stripe-billing-webhook` is live and will receive events from Stripe immediately
- Stripe retries for 72h, so any events fired during Phase 12→13 transition are not lost
- Ready for Plan 13-02: `create-subscription` Edge Function, which triggers `customer.subscription.created` (handled by this webhook)

---
*Phase: 13-billing-backend*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: `Cenlar demand gt 1-17/supabase/functions/stripe-billing-webhook/index.ts`
- FOUND: `.planning/phases/13-billing-backend/13-01-SUMMARY.md`
- FOUND: commit `a9276e3`
