---
phase: 13-billing-backend
plan: "02"
subsystem: payments
tags: [stripe, supabase, edge-functions, deno, subscriptions, billing-portal, trial]

# Dependency graph
requires:
  - phase: 13-billing-backend/13-01
    provides: stripe-billing-webhook deployed (subscription state writer)
  - phase: 12-subscription-foundation
    provides: trainer_profiles with stripe_customer_id and subscription_id columns; 4 Stripe Price IDs configured
provides:
  - create-subscription Edge Function (JWT-gated, starts 30-day trial, idempotent customer creation)
  - manage-subscription Edge Function (JWT-gated, returns Stripe Customer Portal URL)
affects: [14-feature-gates-search, 15-subscription-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webhook-as-sole-writer: Edge Functions never write subscription_tier/subscription_status; only the stripe-billing-webhook writes subscription state to prevent race conditions"
    - "Idempotent Stripe customer: reuse stripe_customer_id if present, create and persist if not"
    - "Customer Portal as management surface: no custom UI needed for upgrades/downgrades/cancellations — Stripe-hosted portal handles all mutations"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/functions/create-subscription/index.ts"
    - "Cenlar demand gt 1-17/supabase/functions/manage-subscription/index.ts"
  modified: []

key-decisions:
  - "create-subscription does not write subscription_tier/status — webhook is the single writer; writing here would cause a race condition since customer.subscription.created fires within milliseconds"
  - "409 guard on subscription_id prevents duplicate Stripe subscriptions if trainer calls create-subscription again while trialing"
  - "manage-subscription returns 400 (not 404) when stripe_customer_id is null — trainer exists but has never subscribed, which is a known valid state requiring actionable guidance"
  - "APP_URL falls back to https://app.fitrush.io if env var not set — safe default prevents portal return_url from being empty"

patterns-established:
  - "Standard Edge Function skeleton: OPTIONS → POST check → try/catch → requireEnv → userClient auth → adminClient DB ops"
  - "Dual-client pattern: userClient (anon key) for JWT validation only, adminClient (service_role) for all DB reads/writes"

requirements-completed: [BILL-01, BILL-03, BILL-04, BILL-05]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 13 Plan 02: Subscription Actions Summary

**Two JWT-gated Edge Functions: create-subscription starts a 30-day Stripe trial (idempotent customer + 409 duplicate guard), manage-subscription returns a Customer Portal URL for all post-trial management.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T21:14:22Z
- **Completed:** 2026-03-16T21:15:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- create-subscription deployed (ACTIVE): validates priceId, creates/reuses Stripe customer, starts 30-day trial subscription, returns { subscriptionId, status: 'trialing' }, guards against duplicates with 409
- manage-subscription deployed (ACTIVE): pure URL generator — creates Stripe Customer Portal session, returns { url } for frontend redirect, covers all subscription lifecycle actions (upgrade, downgrade, cancel, payment method update) without custom UI
- Both functions follow webhook-as-sole-writer pattern — subscription_tier and subscription_status never written by these functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create create-subscription Edge Function** - `b99b387` (feat)
2. **Task 2: Create manage-subscription Edge Function** - `c5cc891` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified

- `Cenlar demand gt 1-17/supabase/functions/create-subscription/index.ts` - Trial subscription creation: JWT auth, idempotent customer creation, 30-day Stripe trial with trial_settings cancel behavior, 409 duplicate guard
- `Cenlar demand gt 1-17/supabase/functions/manage-subscription/index.ts` - Customer Portal URL generation: JWT auth, 400 if no stripe_customer_id, billingPortal.sessions.create() with APP_URL fallback

## Decisions Made

- create-subscription does not write subscription_tier/status — webhook is the single writer (race condition prevention)
- 409 guard checks subscription_id field — if set, trainer already has an active subscription
- manage-subscription returns 400 (not 404) for trainers with no stripe_customer_id — communicates actionable state ("start a trial first")
- APP_URL env var used for portal return_url with fallback to https://app.fitrush.io

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond what was set in Phase 12.

## Next Phase Readiness

- Both functions are ACTIVE in Supabase (project qecwxvvlpvrnrqyrdxrj)
- stripe-billing-webhook (Plan 01) is also ACTIVE — full billing pipeline is live
- Phase 14 (Feature Gates + Search) can now read subscription_tier from trainer_profiles and gate features accordingly
- Phase 15 (Subscription UI) can call create-subscription and manage-subscription from the frontend

## Self-Check: PASSED

- FOUND: create-subscription/index.ts
- FOUND: manage-subscription/index.ts
- FOUND: 13-02-SUMMARY.md
- FOUND: commit b99b387 (feat: create-subscription)
- FOUND: commit c5cc891 (feat: manage-subscription)

---
*Phase: 13-billing-backend*
*Completed: 2026-03-16*
