---
phase: 13
slug: billing-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Stripe CLI (`stripe trigger`) + curl for manual E2E |
| **Config file** | None — no automated test suite in this project |
| **Quick run command** | `stripe trigger customer.subscription.deleted` |
| **Full suite command** | Manual validation per success criteria checklist |
| **Estimated runtime** | ~5 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Run `stripe trigger customer.subscription.deleted` to verify idempotency (most common webhook failure mode)
- **Per wave merge:** Run all 6 `stripe trigger` commands against deployed functions; verify DB state after each
- **Phase gate:** All 6 success criteria passing before `/gsd:verify-work`

---

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Command / Method | Infrastructure Exists? |
|--------|----------|-----------|-----------------|----------------------|
| BILL-01 | `create-subscription` creates Customer + trialing subscription | Integration | `curl -X POST .../create-subscription -H "Authorization: Bearer $JWT" -d '{"priceId":"price_xxx"}'` | Edge Function (this phase) |
| BILL-02 | `customer.subscription.deleted` sets `subscription_tier='free'` | Integration | `stripe trigger customer.subscription.deleted` | Webhook function (this phase) |
| BILL-03 | Trainer upgrades via portal | Manual | Stripe Dashboard test mode portal flow | Customer Portal configured (Phase 12) |
| BILL-04 | Monthly and annual billing paths work | Integration | Call `create-subscription` with each of the 4 Price IDs | Price IDs in secrets (Phase 12) |
| BILL-05 | `manage-subscription` returns valid portal URL | Integration | `curl -X POST .../manage-subscription -H "Authorization: Bearer $JWT"` | Edge Function (this phase) |
| BILL-06 | All 6 webhook events correctly sync DB | Integration | `stripe trigger <event>` for each of 6 events | Webhook function (this phase) |
| BILL-07 | `invoice.payment_failed` on active sub downgrades to free | Integration | `stripe trigger invoice.payment_failed` | Webhook function (this phase) |
| BILL-08 | `trial_will_end` sends Resend email | Integration | `stripe trigger customer.subscription.trial_will_end` + check Resend logs | Webhook function + RESEND_API_KEY |

---

## Wave 0 Gaps (files that must exist before validation can run)

- [ ] `supabase/functions/stripe-billing-webhook/index.ts` — covers BILL-02, BILL-03, BILL-06, BILL-07, BILL-08
- [ ] `supabase/functions/create-subscription/index.ts` — covers BILL-01, BILL-04
- [ ] `supabase/functions/manage-subscription/index.ts` — covers BILL-05
- [ ] `supabase/migrations/20260316200000_admin_mrr.sql` — covers Phase 13 SC 6
- [ ] Confirm `APP_URL` secret is set in Supabase; set if missing
- [ ] Confirm `RESEND_API_KEY` secret is set in Supabase (non-blocking if absent)
