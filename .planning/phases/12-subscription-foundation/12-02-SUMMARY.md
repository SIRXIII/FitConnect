---
phase: 12-subscription-foundation
plan: "02"
subsystem: infra
tags: [stripe, supabase, secrets, webhooks, products, pricing, customer-portal]

# Dependency graph
requires:
  - phase: 12-01
    provides: subscription schema live in production — Phase 13 Edge Functions need the Stripe config this plan delivers
provides:
  - FitRush Pro product with Pro Monthly ($9) and Pro Yearly ($86.40) prices in Stripe
  - FitRush Elite product with Elite Monthly ($29) and Elite Yearly ($278.40) prices in Stripe
  - Stripe Customer Portal configured (cancel at period end, update payment, switch plans)
  - Dunning terminal action set to Cancel — ensures customer.subscription.deleted fires after exhausted retries
  - Billing webhook endpoint at stripe-billing-webhook URL with 8 events registered and whsec_ secret captured
  - 5 Supabase secrets set: STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_ELITE_MONTHLY, STRIPE_PRICE_ELITE_YEARLY, STRIPE_BILLING_WEBHOOK_SECRET
affects:
  - 13-billing-backend
  - 15-subscription-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Separate billing webhook endpoint (distinct from Connect webhook) with its own whsec_ secret
    - Dunning terminal action = Cancel to guarantee subscription.deleted event fires
    - Supabase secrets as the bridge between Stripe Dashboard IDs and Edge Function runtime

key-files:
  created:
    - ".planning/phases/12-subscription-foundation/SETUP_CHECKLIST.md"
  modified: []

key-decisions:
  - "Billing webhook endpoint registered before Phase 13 deploys — Stripe retries for 72 hours so events during the gap are safely queued"
  - "Dunning terminal action set to Cancel (not past_due/unpaid) — required for customer.subscription.deleted to fire after payment exhaustion"
  - "Separate billing endpoint from existing Connect stripe-webhook endpoint — separate signing secrets prevent cross-contamination"

patterns-established:
  - "Checklist-as-record pattern: SETUP_CHECKLIST.md serves as both operator instructions and ID recording document"

requirements-completed: [INFRA-12]

# Metrics
duration: 10h 0m
completed: 2026-03-16
---

# Phase 12 Plan 02: Stripe + Supabase Configuration Summary

**2 Stripe Products (Pro/Elite), 4 Prices, Customer Portal, dunning Cancel action, billing webhook with 8 events, and 5 Supabase secrets — Phase 13 prerequisites fully satisfied**

## Performance

- **Duration:** ~10h (human-action checkpoint — Stripe Dashboard manual configuration)
- **Started:** 2026-03-16T07:35:26Z
- **Completed:** 2026-03-16T17:30:33Z
- **Tasks:** 2 (1 auto + 1 human-action checkpoint)
- **Files modified:** 1

## Accomplishments

- Created SETUP_CHECKLIST.md with 8 ordered steps covering all Stripe Dashboard and Supabase secret configuration
- Human operator completed all 8 steps: 2 Products, 4 Prices, Customer Portal, dunning action, billing webhook, and 5 Supabase secrets
- Phase 13 (Billing Backend) can now proceed — all Price IDs and the webhook signing secret are available in the Supabase secrets store at Edge Function runtime

## Task Commits

Each task was committed atomically:

1. **Task 1: Write SETUP_CHECKLIST.md** - `1a5822b` (chore)
2. **Task 2: Human-action checkpoint** - no code commit (dashboard configuration only)

**Plan metadata:** committed with docs commit below

## Files Created/Modified

- `.planning/phases/12-subscription-foundation/SETUP_CHECKLIST.md` - Step-by-step operator instructions with Price ID recording blanks, portal config, dunning config, webhook registration, and Supabase CLI secret-set commands

## Decisions Made

- Registered the billing webhook endpoint before Phase 13 deploys — Stripe queues and retries for 72 hours, so events fired during the Phase 12 to Phase 13 gap are not lost
- Dunning terminal action set to Cancel (not the Stripe default of "Mark as past due") — without this, `customer.subscription.deleted` never fires after retry exhaustion and trainers retain paid features indefinitely
- Kept billing endpoint separate from the existing `stripe-webhook` Connect endpoint — each has its own signing secret to prevent cross-event contamination

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all 8 checklist steps completed without issue.

## User Setup Required

All external service configuration was completed by the human operator:

**Stripe Dashboard:**
- FitRush Pro: 2 prices (Pro Monthly $9/mo, Pro Yearly $86.40/yr)
- FitRush Elite: 2 prices (Elite Monthly $29/mo, Elite Yearly $278.40/yr)
- Customer Portal: cancel at period end + update payment + switch plans enabled
- Revenue recovery: terminal action = Cancel
- Billing webhook: `stripe-billing-webhook` endpoint registered with 8 events, `whsec_*` secret captured

**Supabase secrets confirmed set (5 total):**
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_ELITE_MONTHLY`
- `STRIPE_PRICE_ELITE_YEARLY`
- `STRIPE_BILLING_WEBHOOK_SECRET`

## Next Phase Readiness

- Phase 13 (Billing Backend) prerequisites fully satisfied: Price IDs available via Supabase secrets for `create-subscription`, webhook signing secret available for `stripe-billing-webhook` event verification
- Phase 12 is complete — both plans (schema migration + Stripe config) are done

## Self-Check: PASSED

- FOUND: `.planning/phases/12-subscription-foundation/SETUP_CHECKLIST.md`
- FOUND: commit `1a5822b` (chore — SETUP_CHECKLIST.md)

---
*Phase: 12-subscription-foundation*
*Completed: 2026-03-16*
