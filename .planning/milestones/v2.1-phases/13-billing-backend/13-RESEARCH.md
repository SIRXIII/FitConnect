# Phase 13: Billing Backend - Research

**Researched:** 2026-03-16
**Domain:** Stripe Billing subscription lifecycle — Edge Functions, webhook handlers, MRR analytics
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | Trainer can start a 30-day free trial of Pro or Elite tier with no credit card required | `create-subscription` Edge Function with `trial_period_days: 30`, `payment_method_collection: 'if_required'`, `trial_settings.end_behavior.missing_payment_method: 'cancel'` |
| BILL-02 | When trial ends with no payment method on file, subscription cancels automatically and trainer reverts to Free tier | `customer.subscription.deleted` handler sets `subscription_tier = 'free'`; Stripe cancels automatically when `missing_payment_method: 'cancel'` is set |
| BILL-03 | Trainer can upgrade from Free or trial to a paid tier by entering payment details | Customer Portal handles this — `manage-subscription` returns portal URL |
| BILL-04 | Trainer can choose monthly or annual billing (annual = 20% discount) | `create-subscription` accepts `priceId` param; 4 Price IDs already in Supabase secrets from Phase 12 |
| BILL-05 | Trainer can upgrade, downgrade, cancel, or update payment method via Stripe Customer Portal (no custom UI required) | `manage-subscription` Edge Function calls `stripe.billingPortal.sessions.create` |
| BILL-06 | Stripe subscription events correctly sync `subscription_tier` to the database via webhook | `stripe-billing-webhook` Edge Function handles 6 event types; writes via service_role to bypass guard trigger |
| BILL-07 | Failed payment on an active (non-trial) subscription triggers automatic downgrade to Free tier in the database | `invoice.payment_failed` handler sets `subscription_tier = 'free'` and `subscription_status = 'past_due'` |
| BILL-08 | Trainer receives an email 3 days before trial ends prompting them to add a payment method | `customer.subscription.trial_will_end` handler calls Resend API directly (non-blocking) |
</phase_requirements>

---

## Summary

Phase 13 implements the full server-side subscription lifecycle for FitRush's trainer billing system. The work consists of three new Supabase Edge Functions (`create-subscription`, `manage-subscription`, `stripe-billing-webhook`) and one migration that extends `get_admin_analytics` with MRR fields. All prerequisite infrastructure from Phase 12 is confirmed in place: the `trainer_profiles` schema with 10 subscription columns, the `subscription_events` audit table with its `UNIQUE(stripe_event_id)` idempotency key, the guard trigger blocking authenticated writes to billing columns, 4 Stripe Price IDs in Supabase secrets, and a dedicated billing webhook endpoint (`stripe-billing-webhook`) registered in Stripe Dashboard with its `STRIPE_BILLING_WEBHOOK_SECRET` already set.

The most important architectural constraint is the separation of the billing webhook from the existing Connect webhook. The existing `stripe-webhook` Edge Function uses `STRIPE_WEBHOOK_SECRET` (a Connect-scoped secret); billing events must be routed to a separate `stripe-billing-webhook` function verified against `STRIPE_BILLING_WEBHOOK_SECRET`. These are categorically different signing secrets — mixing them causes all billing events to fail signature verification silently. The webhook writes subscription state to the DB using the service-role client, which bypasses the `guard_subscription_tier_write` trigger (the trigger explicitly allows `service_role` writes).

The existing `get_admin_analytics` RPC currently returns `totals` and `top_earners`. Phase 13 adds `mrr`, `pro_subscriber_count`, and `elite_subscriber_count` to that response via an additive migration. MRR requires normalizing annual subscriptions to monthly equivalents and handling trial-status trainers (trialing trainers count toward MRR at their subscribed price; they will convert or cancel at trial end).

**Primary recommendation:** Implement `stripe-billing-webhook` first (it unblocks success criteria 2, 3, 4), then `create-subscription` (unblocks SC 1), then `manage-subscription` (SC 5), then the MRR migration (SC 6).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` (Deno npm) | `npm:stripe@14.25.0` | Stripe API client in Edge Functions | Matches version used in existing `stripe-webhook` and `create-payout` functions — use the same version for consistency |
| `@supabase/supabase-js` | `https://esm.sh/@supabase/supabase-js@2.49.8` | Supabase client in Edge Functions | Matches every existing Edge Function (don't mix import styles) |
| Resend (fetch API) | N/A — direct `fetch` to `api.resend.com/emails` | Trial-will-end email | Pattern established in `create-payout` and `stripe-webhook` — no SDK, raw fetch with `RESEND_API_KEY` guard |

**Version discrepancy to resolve:** `create-setup-intent` uses `npm:stripe@17` with API version `2025-02-24.acacia`. Other functions use `npm:stripe@14.25.0` with API version `2023-10-16`. For Phase 13, use the version in the existing `stripe-webhook` (`npm:stripe@14.25.0`, `apiVersion: '2023-10-16'`) to stay consistent with the functions being extended. The STACK.md mentions `stripe@20.4.1` as a research suggestion — do NOT use this; it would introduce version mixing across functions.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `_shared/cors.ts` | local | CORS headers (`corsHeaders`) | All Edge Functions that accept preflight |
| `_shared/env.ts` | local | `requireEnv()` helper | Required env vars that must throw if missing |
| `jsr:@supabase/functions-js/edge-runtime.d.ts` | N/A | Deno type definitions | First import in every Edge Function |

### No New Installs

Zero new packages. All dependencies are already present in the project via existing Edge Functions.

---

## Architecture Patterns

### Established Edge Function Structure

Every existing Edge Function follows this exact skeleton — new functions MUST match it:

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    // ... function body
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

The catch block returns 400 (not 500) for all thrown errors — match this for `stripe-billing-webhook` too (Stripe's `constructEvent` throws on bad signature, which should return 400).

### Auth Pattern: User-Gated vs. No-Auth

**User-gated functions** (`create-subscription`, `manage-subscription`):

```typescript
const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
const authHeader = req.headers.get('Authorization') || '';
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false },
});
const { data: { user }, error: userError } = await userClient.auth.getUser();
if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });
}
// Then use adminClient (service_role) for DB writes
const adminClient = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
```

**Webhook function** (`stripe-billing-webhook`): No JWT middleware — Stripe authenticates via signature. Skip `SUPABASE_ANON_KEY`; use only `adminClient` with service-role key.

### Webhook Handler: Separate Function, Same Pattern as `stripe-webhook`

The new `stripe-billing-webhook` function:
1. Reads raw body via `req.text()` (NOT `req.json()` — breaks HMAC signature)
2. Verifies against `STRIPE_BILLING_WEBHOOK_SECRET` (NOT `STRIPE_WEBHOOK_SECRET`)
3. Uses `adminClient` (service-role) for all DB writes — required to bypass the `guard_subscription_tier_write` trigger
4. Implements two-layer idempotency (see below)

Webhook routing distinction: the existing `stripe-webhook` receives Connect events (`event.account` field present); `stripe-billing-webhook` receives platform billing events (`event.account` absent).

### Idempotency Pattern (Two Layers)

**Layer 1 — DB unique constraint (already in schema):**

```typescript
// subscription_events has UNIQUE(stripe_event_id) from Phase 12 migration
const { error: insertError } = await adminClient
  .from('subscription_events')
  .insert({
    trainer_id: trainerProfileId,
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
  });

if (insertError?.code === '23505') {
  // Duplicate event — already processed
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

**Layer 2 — Timestamp guard for out-of-order events:**

```typescript
// Only write subscription state if incoming event is newer than stored state
await adminClient
  .from('trainer_profiles')
  .update({ subscription_tier: newTier, subscription_status: newStatus, ... })
  .eq('stripe_customer_id', customerId)
  .lt('current_period_end', newPeriodEnd); // skip if DB already has newer state
```

Return HTTP 200 for already-processed events. Non-2xx causes Stripe to retry.

### Webhook Event Handler Map

The `stripe-billing-webhook` switch block handles these 6 events (minimum viable set for BILL-02 through BILL-08):

| Event | DB Write | Notes |
|-------|----------|-------|
| `customer.subscription.created` | Set `subscription_tier`, `subscription_status='trialing'`, `subscription_id`, `trial_ends_at`, `current_period_end`, `subscription_interval` | Derive tier from Price metadata or Price ID match against secrets |
| `customer.subscription.updated` | Sync all subscription columns | Handle `cancel_at_period_end: true` — write `cancel_at_period_end` flag to DB |
| `customer.subscription.deleted` | `subscription_tier='free'`, `subscription_status='canceled'`, `subscription_id=null`, `cancel_at_period_end=false` | Fires for trial expiry AND cancellation AND retry exhaustion |
| `customer.subscription.trial_will_end` | No DB write — send Resend email only | Stripe fires this 3 days before trial ends |
| `invoice.paid` | `subscription_status='active'`, `current_period_end` updated | Most reliable "billing period succeeded" signal |
| `invoice.payment_failed` | `subscription_tier='free'`, `subscription_status='past_due'` | BILL-07: downgrade on first failure for non-trial subscriptions |

**Tier derivation from Stripe event:** The subscription object contains `items.data[0].price.id`. Compare against env vars `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_ELITE_MONTHLY`, `STRIPE_PRICE_ELITE_YEARLY` to determine which tier. Keep a lookup map:

```typescript
const TIER_FROM_PRICE: Record<string, 'pro' | 'elite'> = {
  [Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')!]:    'pro',
  [Deno.env.get('STRIPE_PRICE_PRO_YEARLY')!]:     'pro',
  [Deno.env.get('STRIPE_PRICE_ELITE_MONTHLY')!]:  'elite',
  [Deno.env.get('STRIPE_PRICE_ELITE_YEARLY')!]:   'elite',
};
const newTier = TIER_FROM_PRICE[priceId] ?? 'free';
```

### `create-subscription` Edge Function

**Key behaviors:**
1. Verify trainer JWT
2. Fetch `trainer_profiles` — check for existing `stripe_customer_id` (idempotent customer creation)
3. If no `stripe_customer_id`: create `stripe.customers.create()` on platform account, persist to DB
4. Check for existing active subscription (`subscription_id` IS NOT NULL) — return early if already subscribed (prevent duplicate subscriptions)
5. Create subscription with `trial_period_days: 30`, `payment_method_collection: 'if_required'`, `trial_settings.end_behavior.missing_payment_method: 'cancel'`
6. Return `{ subscriptionId, status: 'trialing' }` — webhook handles DB sync (don't double-write tier here; the `customer.subscription.created` webhook will fire and update the DB)

**Why not write DB state from `create-subscription` directly:** The webhook fires milliseconds after subscription creation. If `create-subscription` also writes tier/status, there's a race condition between the two writes. Let the webhook be the single writer of subscription state.

### `manage-subscription` Edge Function

**Simplest possible implementation:**

```typescript
// Verify JWT, fetch stripe_customer_id from trainer_profiles
// Return 400 if no stripe_customer_id (trainer never started a subscription)
const session = await stripe.billingPortal.sessions.create({
  customer: trainerProfile.stripe_customer_id,
  return_url: `${Deno.env.get('APP_URL')}/trainer/dashboard?tab=subscription`,
});
return new Response(JSON.stringify({ url: session.url }), { status: 200 });
```

The portal URL is the entire surface area of this function. No proration logic, no plan change code — the portal handles everything.

**APP_URL secret:** Verify this is set in Supabase secrets. If not, fall back to a hardcoded production URL or add it during this phase.

### MRR Migration: Extend `get_admin_analytics`

The existing function (Phase 10 migration `20260315000000_analytics_rpc.sql`) returns `{ totals, top_earners }`. Phase 13 adds `{ mrr, pro_subscriber_count, elite_subscriber_count }`.

**MRR calculation approach:**

```sql
WITH subscription_mrr AS (
  SELECT
    COUNT(*) FILTER (
      WHERE subscription_tier = 'pro'
        AND subscription_status IN ('active', 'trialing')
    ) AS pro_subscriber_count,
    COUNT(*) FILTER (
      WHERE subscription_tier = 'elite'
        AND subscription_status IN ('active', 'trialing')
    ) AS elite_subscriber_count,
    -- MRR: normalize annual to monthly
    COALESCE(SUM(
      CASE
        WHEN subscription_tier = 'pro'   AND subscription_interval = 'month' THEN 9.00
        WHEN subscription_tier = 'pro'   AND subscription_interval = 'year'  THEN 86.40 / 12
        WHEN subscription_tier = 'elite' AND subscription_interval = 'month' THEN 29.00
        WHEN subscription_tier = 'elite' AND subscription_interval = 'year'  THEN 278.40 / 12
        ELSE 0
      END
    ) FILTER (
      WHERE subscription_status IN ('active', 'trialing')
    ), 0) AS mrr
  FROM public.trainer_profiles
)
```

Include `trialing` in MRR: trialing subscribers have a real subscription and will convert to paid (or cancel). Not including them would understate MRR. This is standard SaaS MRR reporting.

The migration is a `CREATE OR REPLACE FUNCTION` — it replaces the existing `get_admin_analytics` with an expanded version that adds the three new fields to the returned JSON. The function signature (params) does not change; only the body and return shape change.

### Project Structure for New Files

```
Cenlar demand gt 1-17/supabase/functions/
├── stripe-billing-webhook/
│   └── index.ts          # New — billing event handler
├── create-subscription/
│   └── index.ts          # New — trainer subscription creation
├── manage-subscription/
│   └── index.ts          # New — Customer Portal URL generator
└── _shared/
    ├── cors.ts            # Existing
    └── env.ts             # Existing

Cenlar demand gt 1-17/supabase/migrations/
└── 20260316200000_admin_mrr.sql    # New — extends get_admin_analytics with MRR
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upgrade/downgrade UI | Custom plan change form | Stripe Customer Portal | Portal handles proration, 3DS, invoice PDFs, card updates — `manage-subscription` returns portal URL |
| Subscription idempotency | Custom dedup logic | `UNIQUE(stripe_event_id)` on `subscription_events` | Already in schema from Phase 12; insert attempt + check `error.code === '23505'` |
| Trial-end cancellation | Cron job checking trial dates | `trial_settings.end_behavior.missing_payment_method: 'cancel'` | Stripe cancels automatically and fires `customer.subscription.deleted` |
| Dunning (retry logic) | Custom retry code | Stripe Smart Retries (already configured in Dashboard) | Phase 12 set terminal action = Cancel; `invoice.payment_failed` is the signal to downgrade |
| MRR calculation | Real-time Stripe API query | SQL against `trainer_profiles` columns | DB columns are the source of truth; Stripe API would add latency to every admin page load |
| Email templating | Custom HTML email system | Raw Resend fetch call (same as `create-payout`) | Existing pattern; no SDK needed for simple transactional email |

---

## Common Pitfalls

### Pitfall 1: Wrong Webhook Secret

**What goes wrong:** Using `STRIPE_WEBHOOK_SECRET` (Connect secret) in `stripe-billing-webhook`. `constructEvent()` throws; all billing events return 400 and are never processed.

**How to avoid:** `stripe-billing-webhook` MUST use `STRIPE_BILLING_WEBHOOK_SECRET`. This is a different secret already stored in Supabase secrets from Phase 12. The existing `stripe-webhook` function keeps using `STRIPE_WEBHOOK_SECRET` — do not change it.

**Warning signs:** Check Stripe Dashboard > billing webhook endpoint after deploy; any 400 responses confirm wrong secret.

### Pitfall 2: Parsing Body as JSON Before Signature Verification

**What goes wrong:** `const body = await req.json()` before `stripe.webhooks.constructEvent()` breaks HMAC-SHA256 verification. Stripe's signature is over raw bytes — re-serialized JSON never matches.

**How to avoid:** Use `const body = await req.text()` (not `req.json()`). The existing `stripe-webhook` already does this correctly at line 33 — copy the same pattern.

### Pitfall 3: Writing Subscription State From `create-subscription` AND Webhook

**What goes wrong:** `create-subscription` writes `subscription_tier='pro'` to DB. Then `customer.subscription.created` fires 200ms later and writes again. Race condition; harder to debug.

**How to avoid:** `create-subscription` writes only `stripe_customer_id` (if new) and returns `{ subscriptionId, status }` to the frontend. The webhook is the single writer of `subscription_tier`, `subscription_status`, `trial_ends_at`, etc.

### Pitfall 4: `invoice.payment_failed` Downgrades Trialing Subscriptions

**What goes wrong:** A trialing trainer who has no payment method gets an `invoice.payment_failed` event (this can happen if they added then removed a card). BILL-07 says only active (non-trial) subscriptions should downgrade on payment failure.

**How to avoid:** In the `invoice.payment_failed` handler, check `subscription_status` before writing:

```typescript
// Only downgrade if currently active, not trialing
const { data: trainer } = await adminClient
  .from('trainer_profiles')
  .select('subscription_status')
  .eq('stripe_customer_id', customerId)
  .single();

if (trainer?.subscription_status === 'active') {
  // downgrade to free
}
// trialing: do nothing — customer.subscription.deleted will fire when trial ends
```

The success criteria explicitly state "active (non-trial) subscription" for BILL-07.

### Pitfall 5: `subscription_events` Insert Fails Without `trainer_id`

**What goes wrong:** The `subscription_events` table has `trainer_id NOT NULL`. Webhook events contain `customer` (a `cus_xxx` ID), not a trainer UUID. Must look up `trainer_id` from `trainer_profiles WHERE stripe_customer_id = event.customer` before inserting.

**How to avoid:** Every webhook handler needs a lookup step:

```typescript
const customerId = (event.data.object as any).customer as string;
const { data: trainer } = await adminClient
  .from('trainer_profiles')
  .select('id, subscription_status')
  .eq('stripe_customer_id', customerId)
  .maybeSingle();

if (!trainer) {
  // Unknown customer — log and return 200 (don't let Stripe retry indefinitely)
  console.warn('[stripe-billing-webhook] Unknown customer:', customerId);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

### Pitfall 6: `cancel_at_period_end` Shows as Deleted Before Period Ends

**What goes wrong:** Trainer clicks "Cancel" in the Customer Portal. This sets `cancel_at_period_end: true`. Stripe fires `customer.subscription.updated` (NOT `deleted`). If the handler only handles `customer.subscription.deleted` for downgrade, the DB isn't updated until the actual period end — but the `customer.subscription.updated` event is the right time to set `cancel_at_period_end = true` in the DB so the UI can show "Cancels on [date]."

**How to avoid:** In the `customer.subscription.updated` handler:

```typescript
const sub = event.data.object as Stripe.Subscription;
const cancelAtPeriodEnd = sub.cancel_at_period_end;
// Always sync cancel_at_period_end flag
await adminClient.from('trainer_profiles').update({
  cancel_at_period_end: cancelAtPeriodEnd,
  // ... other sync fields
}).eq('stripe_customer_id', sub.customer);
```

### Pitfall 7: Stripe API Version Mismatch

The existing `stripe-webhook` uses `apiVersion: '2023-10-16'`; `create-setup-intent` uses `2025-02-24.acacia`. Use `2023-10-16` to match the functions being extended. The Stripe npm package version `14.25.0` has this as its default API version. Using `stripe@17+` changes the TypeScript types (some properties become optional or renamed).

---

## Code Examples

### Billing Webhook Skeleton (verified from existing `stripe-webhook` pattern)

```typescript
// Source: stripe-webhook/index.ts (existing, adapted for billing)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
    const billingWebhookSecret = requireEnv('STRIPE_BILLING_WEBHOOK_SECRET');

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.text();      // MUST be text(), not json()
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = stripe.webhooks.constructEvent(body, signature, billingWebhookSecret);

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Build price→tier map from env
    const TIER_FROM_PRICE: Record<string, 'pro' | 'elite'> = {
      [Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')!]:    'pro',
      [Deno.env.get('STRIPE_PRICE_PRO_YEARLY')!]:     'pro',
      [Deno.env.get('STRIPE_PRICE_ELITE_MONTHLY')!]:  'elite',
      [Deno.env.get('STRIPE_PRICE_ELITE_YEARLY')!]:   'elite',
    };

    // Resolve trainer from customer ID (shared across most handlers)
    const resolveTrainer = async (customerId: string) => {
      const { data } = await adminClient
        .from('trainer_profiles')
        .select('id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      return data;
    };

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': { /* ... */ break; }
      case 'customer.subscription.deleted': { /* ... */ break; }
      case 'customer.subscription.trial_will_end': { /* email only */ break; }
      case 'invoice.paid': { /* ... */ break; }
      case 'invoice.payment_failed': { /* downgrade if active */ break; }
      default: break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

### Subscription Creation (verified from ARCHITECTURE.md + STACK.md)

```typescript
// Source: ARCHITECTURE.md section 2 + STACK.md trial mechanics section
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  trial_period_days: 30,
  payment_settings: {
    save_default_payment_method: 'on_subscription',
  },
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'cancel',
    },
  },
});
// Return subscriptionId to frontend; let webhook handle DB state
```

### Customer Portal Session (verified from STACK.md)

```typescript
// Source: STACK.md Customer Portal section
const session = await stripe.billingPortal.sessions.create({
  customer: trainerProfile.stripe_customer_id,
  return_url: `${Deno.env.get('APP_URL')}/trainer/dashboard?tab=subscription`,
});
return new Response(JSON.stringify({ url: session.url }), { status: 200 });
```

### Trial-Will-End Email (verified from `create-payout` Resend pattern)

```typescript
// Source: create-payout/index.ts Resend pattern (lines 246-260)
const resendApiKey = Deno.env.get('RESEND_API_KEY');
if (resendApiKey) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FitRush <noreply@resend.dev>',
      to: [trainerEmail],
      subject: 'Your FitRush trial ends in 3 days',
      html: `<p>Your FitRush Pro trial ends on ${trialEndDate}.
             <a href="${portalUrl}">Add a payment method</a> to keep your access.</p>`,
    }),
  }).catch((err: unknown) => console.error('[stripe-billing-webhook] Resend error:', err));
} else {
  console.log('[stripe-billing-webhook] No RESEND_API_KEY — skipping trial-end email');
}
// Email is non-blocking; never throw on email failure
```

### MRR Extension to `get_admin_analytics` (new migration)

```sql
-- Migration: 20260316200000_admin_mrr.sql
-- Extends get_admin_analytics to include mrr, pro_subscriber_count, elite_subscriber_count
CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  p_start  timestamptz,
  p_end    timestamptz,
  p_bucket text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role   text;
  v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH platform_totals AS (
    SELECT
      COALESCE(SUM(amount), 0)          AS total_revenue,
      COALESCE(SUM(platform_fee), 0)    AS total_platform_fee,
      COALESCE(SUM(trainer_payout), 0)  AS total_payouts,
      COUNT(*)                          AS booking_volume
    FROM public.payments
    WHERE status = 'succeeded'
      AND created_at BETWEEN p_start AND p_end
  ),
  top_earners AS (
    SELECT
      pr.full_name                      AS trainer_name,
      SUM(pm.amount)                    AS gross,
      SUM(pm.trainer_payout)            AS net,
      COUNT(*)                          AS bookings_count
    FROM public.payments pm
    JOIN public.bookings b   ON b.id = pm.booking_id
    JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
    JOIN public.profiles pr  ON pr.id = tp.user_id
    WHERE pm.status = 'succeeded'
      AND pm.created_at BETWEEN p_start AND p_end
    GROUP BY pr.full_name
    ORDER BY net DESC
    LIMIT 10
  ),
  subscription_stats AS (
    SELECT
      COUNT(*) FILTER (
        WHERE subscription_tier = 'pro'
          AND subscription_status IN ('active', 'trialing')
      ) AS pro_subscriber_count,
      COUNT(*) FILTER (
        WHERE subscription_tier = 'elite'
          AND subscription_status IN ('active', 'trialing')
      ) AS elite_subscriber_count,
      COALESCE(SUM(
        CASE
          WHEN subscription_tier = 'pro'   AND subscription_interval = 'month' THEN 9.00
          WHEN subscription_tier = 'pro'   AND subscription_interval = 'year'  THEN 86.40 / 12.0
          WHEN subscription_tier = 'elite' AND subscription_interval = 'month' THEN 29.00
          WHEN subscription_tier = 'elite' AND subscription_interval = 'year'  THEN 278.40 / 12.0
          ELSE 0
        END
      ) FILTER (
        WHERE subscription_status IN ('active', 'trialing')
          AND subscription_tier IN ('pro', 'elite')
      ), 0) AS mrr
    FROM public.trainer_profiles
  )
  SELECT jsonb_build_object(
    'totals',                (SELECT row_to_json(platform_totals) FROM platform_totals)::jsonb,
    'top_earners',           COALESCE((SELECT jsonb_agg(row_to_json(top_earners)) FROM top_earners), '[]'::jsonb),
    'mrr',                   (SELECT mrr FROM subscription_stats),
    'pro_subscriber_count',  (SELECT pro_subscriber_count FROM subscription_stats),
    'elite_subscriber_count',(SELECT elite_subscriber_count FROM subscription_stats)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
```

---

## Schema Contract From Phase 12 (Already Live in Production)

These columns exist on `public.trainer_profiles` and are the write targets for Phase 13:

| Column | Type | Default | Written by |
|--------|------|---------|------------|
| `stripe_customer_id` | text | NULL | `create-subscription` (first time only) |
| `subscription_tier` | text | `'free'` | `stripe-billing-webhook` via service_role |
| `subscription_status` | text | `'inactive'` | `stripe-billing-webhook` via service_role |
| `subscription_id` | text | NULL | `stripe-billing-webhook` via service_role |
| `subscription_interval` | text | NULL | `stripe-billing-webhook` via service_role |
| `trial_ends_at` | timestamptz | NULL | `stripe-billing-webhook` via service_role |
| `current_period_end` | timestamptz | NULL | `stripe-billing-webhook` via service_role |
| `cancel_at_period_end` | boolean | false | `stripe-billing-webhook` via service_role |
| `tier_overridden_by` | uuid | NULL | Phase 16 only |
| `tier_overridden_at` | timestamptz | NULL | Phase 16 only |

**Critical:** The `guard_subscription_tier_write` BEFORE UPDATE trigger blocks writes from any role except `service_role` and `admin`. All webhook handler writes MUST use the `adminClient` created with `SUPABASE_SERVICE_ROLE_KEY`.

**Environment variables confirmed set (from Phase 12):**
- `STRIPE_SECRET_KEY`
- `STRIPE_BILLING_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_ELITE_MONTHLY`
- `STRIPE_PRICE_ELITE_YEARLY`

**Environment variables needed by Phase 13 that may not be set:**
- `RESEND_API_KEY` — listed as a known concern in STATE.md ("requires RESEND_API_KEY vault secret before email delivery goes live"). Follow the non-blocking pattern: check for presence, log if missing, never throw.
- `APP_URL` — needed for `manage-subscription` portal return_url. Verify or hardcode Netlify production URL.

---

## Stripe CLI Testing Commands

These are the exact commands for verifying each success criterion against the deployed functions:

```bash
# SC 1: Verify create-subscription creates Customer + trialing subscription
# (call via curl with trainer JWT — see SETUP_CHECKLIST.md pattern)

# SC 2: Simulate subscription deletion (idempotency test)
stripe trigger customer.subscription.deleted
# Send same event twice — second should be a no-op (23505 unique constraint)

# SC 3: Simulate payment failure on active subscription
stripe trigger invoice.payment_failed

# SC 4: Simulate trial_will_end
stripe trigger customer.subscription.trial_will_end

# SC 5: Verify manage-subscription returns portal URL
# (call via curl with trainer JWT)

# SC 6: Verify get_admin_analytics includes mrr fields
# (call via supabase.rpc('get_admin_analytics', {...}))

# Forward events to local for development:
stripe listen --forward-to https://<project>.supabase.co/functions/v1/stripe-billing-webhook
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Stripe CLI (`stripe trigger`) + curl for manual E2E |
| Config file | None — no automated test suite in this project |
| Quick run command | `stripe trigger customer.subscription.deleted` |
| Full suite command | Manual validation per success criteria checklist |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Command / Method | Infrastructure Exists? |
|--------|----------|-----------|-----------------|----------------------|
| BILL-01 | `create-subscription` creates Customer + trialing subscription | Integration | `curl -X POST .../create-subscription -H "Authorization: Bearer $JWT" -d '{"priceId":"price_xxx"}'` | Edge Function needed (Wave 0) |
| BILL-02 | `customer.subscription.deleted` sets `subscription_tier='free'` | Integration | `stripe trigger customer.subscription.deleted` | Webhook function needed (Wave 0) |
| BILL-03 | Trainer upgrades via portal | Manual | Stripe Dashboard test mode portal flow | Customer Portal configured (Phase 12) |
| BILL-04 | Monthly and annual billing paths work | Integration | Call `create-subscription` with each of the 4 Price IDs | Price IDs in secrets (Phase 12) |
| BILL-05 | `manage-subscription` returns valid portal URL | Integration | `curl -X POST .../manage-subscription -H "Authorization: Bearer $JWT"` | Edge Function needed (Wave 0) |
| BILL-06 | All 6 webhook events correctly sync DB | Integration | `stripe trigger <event>` for each | Webhook function needed (Wave 0) |
| BILL-07 | `invoice.payment_failed` on active sub downgrades to free | Integration | `stripe trigger invoice.payment_failed` | Webhook function needed (Wave 0) |
| BILL-08 | `trial_will_end` sends Resend email | Integration | `stripe trigger customer.subscription.trial_will_end` + check Resend logs | Webhook function + RESEND_API_KEY needed |

### Wave 0 Gaps

- [ ] `supabase/functions/stripe-billing-webhook/index.ts` — covers BILL-02, BILL-03, BILL-06, BILL-07, BILL-08
- [ ] `supabase/functions/create-subscription/index.ts` — covers BILL-01, BILL-04
- [ ] `supabase/functions/manage-subscription/index.ts` — covers BILL-05
- [ ] `supabase/migrations/20260316200000_admin_mrr.sql` — covers ADMN-03 (SC 6)
- [ ] Confirm `APP_URL` secret is set in Supabase; set if missing
- [ ] Confirm `RESEND_API_KEY` secret is set in Supabase (non-blocking path if absent)

### Sampling Rate

- **Per task commit:** `stripe trigger customer.subscription.deleted` to verify idempotency (most common webhook failure mode)
- **Per wave merge:** Run all 6 `stripe trigger` commands against deployed functions; verify DB state after each
- **Phase gate:** All 6 success criteria passing before `/gsd:verify-work`

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Checking `event.account` to distinguish Connect vs. Billing events in one webhook | Separate endpoint for billing events (`stripe-billing-webhook`) | Phase 12 decision: reduces routing complexity and secret collision risk |
| `CardElement` for payment capture | Customer Portal (no custom UI) | Stripe deprecated CardElement; portal gives 3DS, Apple Pay, card updates for free |
| Stripe Entitlements API | `subscription_tier` DB column | Out of scope per REQUIREMENTS.md — DB column + webhook is correct at 3-tier scale |

---

## Open Questions

1. **`APP_URL` secret availability**
   - What we know: `manage-subscription` needs it for `return_url`
   - What's unclear: Whether the operator set it during Phase 12 setup (it wasn't in the 5 secrets listed in 12-02-SUMMARY)
   - Recommendation: Verify at implementation time; if absent, add a `stripe listen` or hardcode the Netlify URL as a fallback during testing

2. **`subscription_interval` column source**
   - What we know: The column exists on `trainer_profiles` and is needed for accurate MRR calculation
   - What's unclear: Whether the Phase 12 schema populates it from webhook events automatically or if Phase 13 must populate it from `subscription.items.data[0].price.recurring.interval`
   - Recommendation: Phase 13 webhook handler must explicitly write `subscription_interval` from the Stripe subscription object's price interval field

3. **Idempotency test for `customer.subscription.deleted` (SC 2)**
   - What we know: The UNIQUE constraint on `stripe_event_id` provides idempotency
   - What's unclear: The success criteria says "a duplicate event with the same `stripe_event_id` is a no-op" — the Stripe CLI `trigger` command always generates a new event ID, so testing true idempotency requires inserting a synthetic duplicate
   - Recommendation: After first trigger, run a manual insert into `subscription_events` with the same `stripe_event_id`, confirm 23505 error and no DB state change

---

## Sources

### Primary (HIGH confidence)

- `Cenlar demand gt 1-17/supabase/functions/stripe-webhook/index.ts` — existing webhook structure, `req.text()` pattern, service-role client pattern, Resend email pattern
- `Cenlar demand gt 1-17/supabase/functions/create-payout/index.ts` — JWT auth pattern, Resend non-blocking email pattern
- `Cenlar demand gt 1-17/supabase/migrations/20260316100000_subscription_foundation.sql` — exact column names and types live in production
- `Cenlar demand gt 1-17/supabase/migrations/20260315000000_analytics_rpc.sql` — existing `get_admin_analytics` function signature and body
- `.planning/research/STACK.md` — Stripe trial mechanics, Customer Portal integration, webhook event list
- `.planning/research/ARCHITECTURE.md` — Edge Function responsibilities, subscription state mapping, idempotency design
- `.planning/research/PITFALLS.md` — all 19 critical and moderate pitfalls
- `.planning/phases/12-subscription-foundation/12-01-SUMMARY.md` — confirms schema is live, guard trigger active, `subscription_events` table present
- `.planning/phases/12-subscription-foundation/12-02-SUMMARY.md` — confirms 5 secrets set, billing webhook registered with 8 events

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — `RESEND_API_KEY` as a known concern; confirmed decisions about separate billing endpoint and dunning terminal action

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — exact versions confirmed from existing Edge Functions
- Architecture: HIGH — all patterns verified against running codebase; schema confirmed live from Phase 12
- Pitfalls: HIGH — sourced from PITFALLS.md which was verified against official Stripe docs
- MRR calculation: MEDIUM — SQL is straightforward but `subscription_interval` population depends on webhook implementation being correct

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (Stripe API and Supabase Edge Function patterns are stable)
