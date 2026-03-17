# Phase 12 — Stripe + Supabase Setup Checklist

Complete all steps in order. Record actual IDs in the blanks — these values are needed for Supabase secrets.

## Step 1: Create FitRush Pro Product

Location: Stripe Dashboard -> Product catalog -> + Add product

- [ ] Product name: `FitRush Pro`
- [ ] Statement descriptor: `FITRUSH PRO`
- [ ] Do NOT set a default price here — add prices in Step 2

## Step 2: Add Prices to FitRush Pro

Still on the FitRush Pro product page, add two recurring prices:

### Price A — Monthly
- [ ] Billing period: Monthly
- [ ] Amount: `$9.00`
- [ ] Currency: USD
- [ ] Nickname: `Pro Monthly`
- [ ] Save and record Price ID: `price_` ________________
      → This becomes `STRIPE_PRICE_PRO_MONTHLY`

### Price B — Annual
- [ ] Billing period: Yearly
- [ ] Amount: `$86.40` (equivalent to $7.20/mo × 12, 20% discount)
- [ ] Currency: USD
- [ ] Nickname: `Pro Yearly`
- [ ] Save and record Price ID: `price_` ________________
      → This becomes `STRIPE_PRICE_PRO_YEARLY`

## Step 3: Create FitRush Elite Product

Location: Stripe Dashboard -> Product catalog -> + Add product

- [ ] Product name: `FitRush Elite`
- [ ] Statement descriptor: `FITRUSH ELITE`
- [ ] Do NOT set a default price here — add prices in Step 4

## Step 4: Add Prices to FitRush Elite

### Price C — Monthly
- [ ] Billing period: Monthly
- [ ] Amount: `$29.00`
- [ ] Currency: USD
- [ ] Nickname: `Elite Monthly`
- [ ] Save and record Price ID: `price_` ________________
      → This becomes `STRIPE_PRICE_ELITE_MONTHLY`

### Price D — Annual
- [ ] Billing period: Yearly
- [ ] Amount: `$278.40` (equivalent to $23.20/mo × 12, 20% discount)
- [ ] Currency: USD
- [ ] Nickname: `Elite Yearly`
- [ ] Save and record Price ID: `price_` ________________
      → This becomes `STRIPE_PRICE_ELITE_YEARLY`

## Step 5: Configure Stripe Customer Portal

Location: Stripe Dashboard -> Settings -> Billing -> Customer portal

- [ ] Enable: **Cancel subscriptions** — ON
- [ ] Cancellation behavior: **Cancel at end of billing period** (not immediately)
- [ ] Enable: **Update payment methods** — ON
- [ ] Enable: **View invoices** — ON
- [ ] Enable: **Switch plans** — ON (allows upgrade/downgrade between Pro and Elite)
- [ ] Save settings

## Step 6: Set Dunning Terminal Action to Cancel

Location: Stripe Dashboard -> Billing -> Revenue recovery -> Retries

CRITICAL: If the terminal action is left at the default "unpaid" or "mark as past due",
the `customer.subscription.deleted` webhook event will NEVER fire after dunning exhaustion.
Trainers would retain paid features indefinitely.

- [ ] Scroll to "After all retries have been exhausted"
- [ ] Terminal action: set to **Cancel subscription** (not "Leave as past due" or "Mark as unpaid")
- [ ] Save settings

## Step 7: Register Billing Webhook Endpoint

Location: Stripe Dashboard -> Developers -> Webhooks -> + Add endpoint

NOTE: The Edge Function `stripe-billing-webhook` does not exist yet — it is created in Phase 13.
The endpoint will return 404 responses until Phase 13 is deployed. Stripe retries for 72 hours,
so all events during the Phase 12 → Phase 13 gap will be successfully delivered once the
function is deployed. This is expected behavior.

- [ ] Endpoint URL: `https://qecwxvvlpvrnrqyrdxrj.supabase.co/functions/v1/stripe-billing-webhook`
- [ ] Select events to listen to:
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `customer.subscription.trial_will_end`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
  - [ ] `invoice.payment_action_required`  ← Phase 13 must implement handler (3DS/SCA challenges)
  - [ ] `invoice.finalization_failed`      ← Phase 13 must implement handler (silent invoice failure)
- [ ] Click "Add endpoint"
- [ ] On the endpoint detail page, click "Reveal" under "Signing secret"
- [ ] Record signing secret: `whsec_` ________________
      → This becomes `STRIPE_BILLING_WEBHOOK_SECRET`

DO NOT use the existing `stripe-webhook` endpoint URL or its signing secret.
Billing events and Connect events must use separate endpoints with separate secrets.

## Step 8: Set Supabase Secrets

Set all 5 secrets using either the Supabase CLI (preferred) or Dashboard.

### Option A — CLI (preferred, run from project root)
```bash
cd "Cenlar demand gt 1-17"
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_REPLACE_ME
supabase secrets set STRIPE_PRICE_PRO_YEARLY=price_REPLACE_ME
supabase secrets set STRIPE_PRICE_ELITE_MONTHLY=price_REPLACE_ME
supabase secrets set STRIPE_PRICE_ELITE_YEARLY=price_REPLACE_ME
supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_REPLACE_ME
```

### Option B — Dashboard
Location: Supabase Dashboard -> Edge Functions -> Manage secrets -> + New secret

Add each secret:
- [ ] `STRIPE_PRICE_PRO_MONTHLY` = value from Step 2 Price A
- [ ] `STRIPE_PRICE_PRO_YEARLY` = value from Step 2 Price B
- [ ] `STRIPE_PRICE_ELITE_MONTHLY` = value from Step 4 Price C
- [ ] `STRIPE_PRICE_ELITE_YEARLY` = value from Step 4 Price D
- [ ] `STRIPE_BILLING_WEBHOOK_SECRET` = value from Step 7

## Verification

After all steps, verify:

```bash
# Confirm secrets are set (values will be masked)
cd "Cenlar demand gt 1-17" && supabase secrets list
```

Expected output includes all 5 new secret names:
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_ELITE_MONTHLY`
- `STRIPE_PRICE_ELITE_YEARLY`
- `STRIPE_BILLING_WEBHOOK_SECRET`

Stripe Dashboard verification:
- Product catalog shows FitRush Pro (2 prices) and FitRush Elite (2 prices)
- Billing -> Customer portal shows cancel/update payment/switch plans enabled
- Billing -> Revenue recovery -> Retries shows terminal action = Cancel
- Developers -> Webhooks shows the billing endpoint with 8 events selected

## Status

- [ ] Step 1: FitRush Pro product created
- [ ] Step 2: Pro Monthly + Pro Yearly prices created
- [ ] Step 3: FitRush Elite product created
- [ ] Step 4: Elite Monthly + Elite Yearly prices created
- [ ] Step 5: Customer Portal configured
- [ ] Step 6: Dunning terminal action set to Cancel
- [ ] Step 7: Billing webhook endpoint registered, whsec_ secret recorded
- [ ] Step 8: All 5 Supabase secrets set
