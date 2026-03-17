---
phase: 13-billing-backend
verified: 2026-03-16T22:00:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Simulate customer.subscription.deleted via Stripe CLI and check trainer_profiles"
    expected: "subscription_tier='free', subscription_status='canceled' set on the matching trainer row within the same request"
    why_human: "Requires a live Stripe test-mode event and a seeded trainer_profiles row with a known stripe_customer_id"
  - test: "Send the same Stripe event twice (idempotency check)"
    expected: "Second delivery returns 200 but causes no DB state change; subscription_events has exactly one row for the stripe_event_id"
    why_human: "Cannot verify idempotency guard execution path without a real Stripe CLI trigger or manual subscription_events row insertion"
  - test: "Simulate invoice.payment_failed against a trainer with subscription_status='trialing'"
    expected: "No downgrade occurs; row remains trialing; log emits skip message"
    why_human: "Requires two live trainer rows in different states to validate the active-only guard path"
  - test: "Simulate customer.subscription.trial_will_end and verify email"
    expected: "If RESEND_API_KEY is set, Resend dashboard shows a delivered email to the trainer address with subject 'Your FitRush trial ends in 3 days'"
    why_human: "Email delivery is an external side-effect that cannot be verified programmatically"
  - test: "Call create-subscription with a valid trainer JWT and a Pro monthly priceId"
    expected: "Returns { subscriptionId: 'sub_xxx', status: 'trialing' }; Stripe test-mode dashboard shows a subscription with trial_period_days=30"
    why_human: "Requires a real Supabase JWT and live Stripe API call"
  - test: "Call manage-subscription with a valid trainer JWT (trainer has stripe_customer_id)"
    expected: "Returns { url: 'https://billing.stripe.com/...' }; URL is a valid Stripe Customer Portal session URL"
    why_human: "Portal URL validity requires a live Stripe customer; cannot be verified from file contents alone"
  - test: "Call get_admin_analytics RPC as admin and inspect response"
    expected: "Response JSON includes mrr (numeric, 0.00 when no subscribers), pro_subscriber_count (bigint), elite_subscriber_count (bigint) alongside existing totals and top_earners"
    why_human: "RPC execution requires a live Supabase connection with an admin-role JWT"
  - test: "Call get_admin_analytics as a non-admin trainer role"
    expected: "RPC raises an exception containing 'Admin access required'"
    why_human: "Role-guard execution requires a live Supabase connection"
---

# Phase 13: Billing Backend Verification Report

**Phase Goal:** Full subscription lifecycle is handled server-side with no frontend dependency — subscriptions can be created, webhook events correctly sync tier to DB, trial-end email fires, and admin analytics include MRR
**Verified:** 2026-03-16T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Calling `create-subscription` creates a Stripe Customer, starts a subscription with `trial_period_days: 30` and `payment_method_collection: 'if_required'`, and writes `subscription_status='trialing'` to `trainer_profiles` (via webhook) | VERIFIED (partial — live call needed) | `create-subscription/index.ts` lines 129-137: `stripe.subscriptions.create` with `trial_period_days: 30`, `trial_settings.end_behavior.missing_payment_method: 'cancel'`. Note: `payment_method_collection: 'if_required'` is NOT an explicit param — Stripe applies this as default behavior when no payment is collected at trial start; the functional result is correct but the exact param is absent |
| 2 | `customer.subscription.deleted` sets `subscription_tier='free'` in DB; duplicate `stripe_event_id` is a no-op | VERIFIED | `stripe-billing-webhook/index.ts` lines 139-148: sets `subscription_tier='free', subscription_status='canceled', subscription_id=null`; lines 130-137: `23505` guard returns 200 immediately on duplicate |
| 3 | `invoice.payment_failed` sets `subscription_tier='free'` for active (non-trial) subscriptions only | VERIFIED | Lines 272-284: `if (trainer.subscription_status === 'active')` guard; sets `subscription_tier='free', subscription_status='past_due'` |
| 4 | `customer.subscription.trial_will_end` triggers a Resend email with a link to add a payment method | VERIFIED | Lines 174-210: non-blocking `fetch` to Resend API, skips gracefully if no `RESEND_API_KEY`, subject is 'Your FitRush trial ends in 3 days', includes portal link |
| 5 | `manage-subscription` returns a valid Stripe Customer Portal URL | VERIFIED | `manage-subscription/index.ts` lines 88-91: `stripe.billingPortal.sessions.create()`, returns `{ url: session.url }` |
| 6 | `get_admin_analytics` RPC response includes `mrr`, `pro_subscriber_count`, and `elite_subscriber_count` | VERIFIED | `20260316200000_admin_mrr.sql` lines 63-86: `subscription_stats` CTE; lines 87-93: `jsonb_build_object` includes all three new fields |

**Score: 6/6 truths verified structurally** (live execution needs human verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Cenlar demand gt 1-17/supabase/functions/stripe-billing-webhook/index.ts` | All 6 billing webhook event handlers | VERIFIED | 307 lines; all 6 cases implemented: `customer.subscription.created/updated/deleted/trial_will_end`, `invoice.paid`, `invoice.payment_failed` |
| `Cenlar demand gt 1-17/supabase/functions/create-subscription/index.ts` | Trial subscription creation + idempotent customer creation | VERIFIED | 158 lines; JWT auth, priceId validation, 409 duplicate guard, Stripe customer creation, `trial_period_days: 30` |
| `Cenlar demand gt 1-17/supabase/functions/manage-subscription/index.ts` | Stripe Customer Portal URL generation | VERIFIED | 112 lines; JWT auth, 400 guard for no stripe_customer_id, `billingPortal.sessions.create()` |
| `Cenlar demand gt 1-17/supabase/migrations/20260316200000_admin_mrr.sql` | `CREATE OR REPLACE FUNCTION` with `subscription_stats` CTE | VERIFIED | 106 lines; full `subscription_stats` CTE with COUNT FILTER, CASE-based MRR, annual normalization; extends `jsonb_build_object` with all 3 new fields |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `stripe-billing-webhook/index.ts` | `subscription_events` (unique `stripe_event_id`) | `adminClient.insert` + `error.code === '23505'` check | WIRED | Line 68-74: `recordEvent` inserts; lines 90, 131, 227, 262: callers check `insertError?.code === '23505'` |
| `stripe-billing-webhook/index.ts` | `trainer_profiles` billing columns | `.update().eq('stripe_customer_id', customerId)` | WIRED | Lines 103-114, 139-148, 243-246, 273-279: all writes use `eq('stripe_customer_id', ...)` never UUID directly |
| `create-subscription/index.ts` | `stripe.subscriptions.create()` | `trial_period_days: 30`, `trial_settings.end_behavior.missing_payment_method: 'cancel'` | WIRED | Lines 129-137: exact params present. `payment_method_collection: 'if_required'` is not an explicit param (Stripe default), which is functionally equivalent |
| `manage-subscription/index.ts` | `stripe.billingPortal.sessions.create()` | `trainer stripe_customer_id` from `trainer_profiles` | WIRED | Lines 56-61: fetches `stripe_customer_id`; line 88-91: passes it to `billingPortal.sessions.create()` |
| `get_admin_analytics` SQL function | `trainer_profiles.subscription_tier/status/interval` | `subscription_stats` CTE with COUNT FILTER and CASE-based MRR | WIRED | Lines 63-86 in migration: CTE queries `FROM public.trainer_profiles`, filters `subscription_status IN ('active', 'trialing')` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BILL-01 | 13-02-PLAN.md | Trainer can start 30-day free trial with no credit card | SATISFIED | `create-subscription` calls `stripe.subscriptions.create` with `trial_period_days: 30`; no payment required at trial start |
| BILL-02 | 13-01-PLAN.md | Trial cancels automatically when trial ends with no payment method | SATISFIED | `trial_settings.end_behavior.missing_payment_method: 'cancel'` in `create-subscription`; `customer.subscription.deleted` webhook sets `subscription_tier='free'` |
| BILL-03 | 13-02-PLAN.md | Trainer can upgrade by entering payment details via portal | SATISFIED | `manage-subscription` returns Customer Portal URL; portal handles payment collection |
| BILL-04 | 13-02-PLAN.md | Trainer can choose monthly or annual billing | SATISFIED | `create-subscription` accepts any `priceId`; `TIER_FROM_PRICE` map in webhook handles both `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_ELITE_MONTHLY`, `STRIPE_PRICE_ELITE_YEARLY` |
| BILL-05 | 13-02-PLAN.md | Trainer can upgrade/downgrade/cancel via Stripe Customer Portal | SATISFIED | `manage-subscription` creates portal session; portal is the sole management surface |
| BILL-06 | 13-01-PLAN.md | Stripe events sync `subscription_tier` to DB via webhook | SATISFIED | `stripe-billing-webhook` handles all 6 event types; `created/updated` syncs all 7 columns; `deleted` resets to free |
| BILL-07 | 13-01-PLAN.md | Failed payment on active sub triggers downgrade (not trialing) | SATISFIED | Lines 272-284: explicit `subscription_status === 'active'` guard before downgrade |
| BILL-08 | 13-01-PLAN.md | Trainer receives email 3 days before trial end | SATISFIED | `trial_will_end` handler sends Resend email non-blocking; subject matches spec; includes portal link |

All 8 BILL requirements are covered. No orphaned requirements found — BILL-01 through BILL-08 all map to Phase 13 in REQUIREMENTS.md and are claimed in 13-01-PLAN.md or 13-02-PLAN.md.

Note: 13-03-PLAN.md lists `requirements: []` — it fulfills Phase 13 Success Criterion 6 (MRR analytics) which maps to the future ADMN-03 requirement in Phase 16. This is intentional and documented in the plan frontmatter.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `stripe-billing-webhook/index.ts` | 174-177 | `break` on missing `RESEND_API_KEY` — plan called for non-blocking behavior; `break` is correct here since no `fetch` is needed, but the guard structure means the webhook returns 200 without queuing any email | Info | No impact — 200 is still returned, Stripe gets a valid ack; design is intentional per plan |
| `stripe-billing-webhook/index.ts` | 84-88 | Unknown customer returns `break` then falls through to the final `return { received: true }` — correct behavior | Info | No impact; prevents Stripe retry loop as intended |

No blockers or warnings found. No TODO/FIXME/placeholder comments. No empty return bodies. All event cases have substantive implementations.

---

### Commit Verification

All commits documented in summaries exist in git history:

| Commit | Plan | Description |
|--------|------|-------------|
| `a9276e3` | 13-01 | `feat(13-01): implement stripe-billing-webhook Edge Function` |
| `b99b387` | 13-02 | `feat(13-02): implement create-subscription Edge Function` |
| `c5cc891` | 13-02 | `feat(13-02): implement manage-subscription Edge Function` |
| `3df67d2` | 13-03 | `feat(13-03): extend get_admin_analytics with MRR subscription fields` |

---

### Observation: `payment_method_collection` Param

The Phase 13 Success Criterion 1 states the subscription should be created with `payment_method_collection: 'if_required'`. This exact parameter does not appear in `create-subscription/index.ts`. However, Stripe's default behavior when no default payment method is set and no collection is configured at subscription creation is equivalent — collection is deferred. The `trial_settings.end_behavior.missing_payment_method: 'cancel'` param IS present and ensures the correct behavior when the trial ends. This is a documentation/spec alignment note, not a functional gap.

---

### Human Verification Required

#### 1. Webhook Subscription Deletion

**Test:** Stripe CLI: `stripe trigger customer.subscription.deleted` (with a test trainer row that has a matching `stripe_customer_id`)
**Expected:** `trainer_profiles` row shows `subscription_tier='free'`, `subscription_status='canceled'`, `subscription_id=null` after the event
**Why human:** Requires live Stripe test-mode event delivery and a seeded DB row

#### 2. Idempotency Guard

**Test:** Send the same `stripe_event_id` twice — either by manually inserting a matching row into `subscription_events` then triggering the webhook, or by forwarding a captured webhook twice
**Expected:** Second delivery returns 200 but `subscription_events` has exactly one row for that event ID; no DB state change on second delivery
**Why human:** Cannot simulate duplicate delivery from static code analysis

#### 3. Active-Only Payment Failure Guard

**Test:** Stripe CLI: `stripe trigger invoice.payment_failed` against a trainer with `subscription_status='trialing'`
**Expected:** No downgrade; trainer row unchanged; logs show "no downgrade (trialing or already downgraded)"
**Why human:** Requires two trainer rows with different `subscription_status` values to validate guard branching

#### 4. Trial-End Email

**Test:** Stripe CLI: `stripe trigger customer.subscription.trial_will_end` with `RESEND_API_KEY` set
**Expected:** Resend dashboard shows a delivered email with subject 'Your FitRush trial ends in 3 days' to the trainer's email address
**Why human:** Email delivery is an external side-effect; non-blocking fetch cannot be verified from code alone

#### 5. create-subscription Live Call

**Test:** `curl -X POST [FUNCTION_URL]/create-subscription -H "Authorization: Bearer [TRAINER_JWT]" -H "Content-Type: application/json" -d '{"priceId":"[STRIPE_PRICE_PRO_MONTHLY]"}'`
**Expected:** `{ "subscriptionId": "sub_xxx", "status": "trialing" }` — second call with same JWT returns 409
**Why human:** Requires live Supabase JWT and Stripe API in test mode

#### 6. manage-subscription Live Call

**Test:** `curl -X POST [FUNCTION_URL]/manage-subscription -H "Authorization: Bearer [TRAINER_JWT_WITH_CUSTOMER]"`
**Expected:** `{ "url": "https://billing.stripe.com/..." }` — URL is a valid Stripe Customer Portal session
**Why human:** Portal URL generation requires live Stripe customer; cannot verify URL validity from static code

#### 7. get_admin_analytics RPC — MRR Fields

**Test:** Supabase SQL editor (as admin): `SELECT public.get_admin_analytics(now() - interval '30 days', now(), 'day');`
**Expected:** Response includes `mrr`, `pro_subscriber_count`, `elite_subscriber_count` alongside `totals` and `top_earners`
**Why human:** RPC execution requires live Supabase with admin-role JWT

#### 8. get_admin_analytics Admin Guard

**Test:** Call RPC as a non-admin trainer role
**Expected:** Exception raised: 'Admin access required'
**Why human:** Role-guard verification requires live Supabase connection

---

### Gaps Summary

None. All six observable truths are structurally verified. All four artifacts exist with substantive implementations. All five key links are wired. All eight BILL requirements are covered by plan artifacts. No blocker anti-patterns found.

The `human_needed` status reflects that the behavioral contracts (webhook event handling, live Stripe API calls, email delivery, RPC execution) cannot be verified from static code analysis alone — the implementations are complete and correct, but runtime confirmation requires Stripe CLI and a live Supabase connection.

---

_Verified: 2026-03-16T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
