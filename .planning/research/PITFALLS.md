# Domain Pitfalls: Stripe Billing on an Existing Connect Marketplace

**Domain:** Adding Stripe Billing (subscription tiers) to a live Stripe Connect Express marketplace
**Project:** FitRush v2.1 — Free / Pro ($9/mo) / Elite ($29/mo) trainer tiers
**Researched:** 2026-03-15
**Confidence:** HIGH — primary sources are current Stripe official documentation; supplemented by verified community patterns

---

## Critical Pitfalls

Mistakes in this section cause security vulnerabilities, billing failures, data corruption, or undetected revenue loss.

---

### Pitfall 1: Billing Customer Object vs. Connect Account — Two Completely Separate Identity Systems

**What goes wrong:**

Developers assume the existing `stripe_account_id` (`acct_xxx`) stored on `trainer_profiles` is sufficient for billing. It is not. A Connect Account object is a _merchant_ identity used for receiving payouts. A Billing Customer object (`cus_xxx`) is a _consumer_ identity used for subscription charges. Stripe's API treats them as entirely separate — there is no way to turn one into the other or share them.

Passing `acct_xxx` where `cus_xxx` is expected causes `stripe.subscriptions.create()` to throw `No such customer` or create a subscription that can never be charged.

**Why it happens:**

The Stripe Dashboard shows both objects, so developers conflate "trainer has a Stripe account" with "trainer is a Stripe customer of my platform." They are orthogonal. Stripe's own docs state: _"The Account object allows the connected account to collect payments from its customers, but the platform can't use it to collect recurring payments from the connected account."_

**Consequences:** Subscription creation silently fails or creates a zombie subscription. Trainers see "Pro" in the UI but invoices are never generated. Or: dev mode works fine (you used `cus_xxx`) but someone hardcodes `stripe_account_id` in a new code path and prod breaks on first upgrade.

**Prevention:**

Maintain two separate Stripe IDs per trainer in the DB:

```
trainer_profiles:
  stripe_account_id   TEXT  -- acct_xxx  (payouts TO the trainer via Connect)
  stripe_customer_id  TEXT  -- cus_xxx   (billing FROM the trainer via Billing)
```

Create the Customer object at first subscription attempt, not at signup:

```typescript
const customer = await stripe.customers.create({
  email: trainer.email,
  metadata: { trainer_id: trainer.id, platform: 'fitrush' },
  // Never pass stripe_account_id here
});
await supabase
  .from('trainer_profiles')
  .update({ stripe_customer_id: customer.id })
  .eq('id', trainer.id);
```

**Detection:** Add a runtime assert: `assert(stripe_customer_id.startsWith('cus_'))` before any subscription operation. Add a DB check constraint: `CHECK (stripe_customer_id LIKE 'cus_%')`.

**Sources:** [Charge SaaS fees to your connected accounts](https://docs.stripe.com/connect/integrate-billing-connect); [Create subscriptions with Stripe Billing (Connect)](https://docs.stripe.com/connect/subscriptions)

---

### Pitfall 2: Webhook Secret Collision — Using the Connect Webhook Secret for Billing Events

**What goes wrong:**

FitRush already has a webhook endpoint (`stripe-webhook`) that processes Connect payout events, verified with `STRIPE_WEBHOOK_SECRET`. Billing subscription events (`customer.subscription.*`, `invoice.*`) originate from the **platform account**, not from connected accounts. These use a different signing secret.

If billing events are routed to the same endpoint and verified with the Connect secret, `stripe.webhooks.constructEvent()` will throw `No signatures found matching the expected signature for payload`. Billing events silently return 400 and are never processed. Stripe retries for up to 3 days, all failing.

**Why it happens:**

Developers register one webhook URL in the Stripe Dashboard, don't realize Stripe uses per-endpoint signing secrets, and the failure mode is silent (400s logged but not alarmed on).

**Prevention:**

Create a second webhook endpoint in the Stripe Dashboard specifically for billing events on the platform account. Store its secret as `STRIPE_BILLING_WEBHOOK_SECRET`. Implement a separate Edge Function `stripe-billing-webhook`. Alternatively, add routing logic at the top of the existing handler:

```typescript
// At top of webhook handler — determine which secret to use
const connectEventAccount = request.headers.get('stripe-connect-account');
const secret = connectEventAccount
  ? process.env.STRIPE_WEBHOOK_SECRET!       // Connect event
  : process.env.STRIPE_BILLING_WEBHOOK_SECRET!; // Platform billing event

const event = stripe.webhooks.constructEvent(rawBody, sig, secret);
```

Verify `event.account` presence: Connect events include an `account` field; platform billing events do not.

**Detection:** After wiring billing, check Stripe Dashboard > Developers > Webhooks > your billing endpoint. If 400 responses appear, this is the problem.

---

### Pitfall 3: Webhook Endpoint Applying Global JSON Body Parsing

**What goes wrong:**

Any middleware that parses the raw request body into a JSON object before signature verification breaks `stripe.webhooks.constructEvent()`. Stripe's HMAC-SHA256 signature is computed over the exact raw bytes. Re-serialized JSON (different key ordering, whitespace, Unicode escaping) will never match.

This is the single most common Stripe integration bug. Every framework has its own trap:

- **Express:** `app.use(express.json())` before the webhook route
- **Next.js App Router:** `await request.json()` instead of `await request.text()`
- **Hono:** default body parsing middleware applied globally

**Consequences:** All webhook events fail verification permanently. `constructEvent` throws. Subscription status changes are never reflected in the DB. Depending on fallback behavior, trainers either get locked out of paid features or retain paid features indefinitely.

**Prevention:**

```typescript
// Next.js App Router — CORRECT
export async function POST(request: Request) {
  const rawBody = await request.text();         // NOT request.json()
  const sig = request.headers.get('stripe-signature')!;
  const event = stripe.webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_BILLING_WEBHOOK_SECRET!
  );
}

// Express — CORRECT: raw middleware applied per-route, before global json()
app.post(
  '/webhooks/stripe-billing',
  express.raw({ type: 'application/json' }),
  billingWebhookHandler
);
```

**Detection:** Run `stripe listen --forward-to localhost:3000/webhooks/stripe-billing`. Any 400 with "No signatures found" confirms this problem.

**Sources:** [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks); [Resolve webhook signature verification errors](https://docs.stripe.com/webhooks/signature)

---

### Pitfall 4: Feature Gate Enforcement Is Client-Side Only

**What goes wrong:**

The typical first implementation reads `trainer.subscription_tier` from the Zustand auth store and renders conditionally. This is purely cosmetic. An authenticated trainer can call the Supabase REST API directly, bypassing React entirely — or open devtools, mutate Zustand state, and access gated features without any server objection.

FitRush already carries documented debt: "Verify and harden RLS policies across all tables." Subscription tiers without server enforcement compound that debt into an exploitable vulnerability.

**Prevention:** Every tier-gated operation must be enforced at the database layer. The UI is UX. The DB is security.

Slot visibility enforced in SQL — not React:

```sql
CREATE POLICY "slot_visibility_by_tier" ON availability_slots
  FOR SELECT USING (
    -- The slot belongs to the querying trainer (they see all their own slots)
    trainer_id = auth.uid()
    OR
    -- Clients see slots up to the tier limit
    slot_index <= (
      SELECT CASE subscription_tier
        WHEN 'free'  THEN 3
        WHEN 'pro'   THEN 20
        WHEN 'elite' THEN 999
        ELSE 3
      END
      FROM trainer_profiles
      WHERE id = availability_slots.trainer_id
    )
  );
```

Analytics endpoints: the `get_trainer_analytics` RPC should check tier inside the function body and return only basic stats for `free` callers — regardless of what the client requests.

`subscription_tier` column: add an UPDATE policy restricting writes to the service-role client only. Trainers must not be able to PATCH their own tier via the REST API.

**Warning signs:**
- `subscription_tier` is a writable column with no UPDATE RLS restriction
- Slot count limit only exists in a React component
- No test confirming a free-tier trainer gets at most 3 slots from a direct API call

---

### Pitfall 5: Storing Subscription Tier in Supabase JWT Claims

**What goes wrong:**

You store `subscription_tier` in the Supabase JWT custom claims so RLS policies can read `auth.jwt() -> 'subscription_tier'`. A trainer downgrades; the webhook updates the DB instantly, but their JWT is valid for another 60 minutes. They retain Pro features for up to an hour post-cancellation.

For most features, 60-minute staleness is acceptable. For features that cost you money per use (AI coaching calls, premium video slots, priority placement bidding) it is not.

**Why it happens:** JWTs are stateless. Supabase's default access token TTL is 1 hour. There is no server-side revocation mechanism without additional infrastructure.

**Prevention — Option A (recommended):** Do not put subscription tier in JWT claims. Query the DB directly in RLS policies via `auth.uid()`:

```sql
CREATE POLICY "pro_feature_gate" ON premium_trainer_features
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_profiles
      WHERE id = auth.uid()
        AND subscription_tier IN ('pro', 'elite')
        AND subscription_status = 'active'
    )
  );
```

This reads the live value on every request. The cost is one extra indexed lookup per policy check — negligible at FitRush's current scale.

**Prevention — Option B (if JWT claims are needed for performance):** Reduce Supabase access token TTL to 5-15 minutes and invalidate the session server-side when the webhook processes a downgrade.

---

### Pitfall 6: Webhook Endpoint Requires No JWT But Must Have Signature Verification

**What goes wrong:**

Scenario A: You apply Supabase JWT middleware globally. Stripe's POST has no Authorization header. Every webhook returns 401 silently.

Scenario B: You exclude the webhook route from JWT auth but forget to add signature verification. Any HTTP client can now POST fake events to your endpoint and grant arbitrary trainers Elite status.

**Prevention:**

The webhook route must be excluded from JWT middleware AND must verify the Stripe signature:

```typescript
// No JWT middleware on this route — Stripe doesn't send Bearer tokens
export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_BILLING_WEBHOOK_SECRET!
    );
  } catch {
    // Log but don't leak error details
    return new Response('Signature verification failed', { status: 400 });
  }

  // Inside handler, use SUPABASE_SERVICE_ROLE_KEY — not anon key
  // Tier writes need to bypass RLS
}
```

The signature verification is the authentication. Never skip it.

---

## Moderate Pitfalls

These cause incorrect billing behavior or degraded UX, but are recoverable.

---

### Pitfall 7: Trial End With No Payment Method — Status Behavior Depends on Unset Config

**What goes wrong:**

A trainer signs up, gets a 14-day trial, never enters a card. On day 15, Stripe's behavior is entirely determined by `trial_settings.end_behavior.missing_payment_method`. If you have not set it, the behavior depends on your account's default invoice settings.

**The status machine:**

| Status | Trigger | Terminal? |
|---|---|---|
| `trialing` | Subscription created with `trial_end` | No |
| `incomplete` | First invoice created, not yet paid (23-hour window) | No |
| `incomplete_expired` | First invoice unpaid for 23 hours | Yes — subscription is dead |
| `past_due` | Renewal invoice failed; Smart Retries in progress | No |
| `unpaid` | Retries exhausted; configured outcome = unpaid | No (recoverable) |
| `canceled` | Manual cancel, retries exhausted, or trial ended with `missing_payment_method=cancel` | Yes |
| `paused` | Trial ended with `missing_payment_method=pause` | No (resumable) |

**Key distinction:** `incomplete_expired` is the terminal state for a first-invoice failure within 23 hours. `canceled` is the terminal state for an explicit cancellation or exhausted dunning. These fire the same event (`customer.subscription.deleted`) but your handler may want to log them differently.

**Prevention:** Always set `missing_payment_method` explicitly at subscription creation:

```typescript
const subscription = await stripe.subscriptions.create({
  customer: trainer.stripe_customer_id,
  items: [{ price: PRICE_ID_PRO }],
  trial_period_days: 14,
  payment_settings: {
    save_default_payment_method: 'on_subscription',
  },
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'cancel', // → fires customer.subscription.deleted
      // Alternatives: 'pause' (→ customer.subscription.paused), 'create_invoice'
    },
  },
});
```

**Events to handle for the full trial flow:**

| Event | When | Action in DB |
|---|---|---|
| `customer.subscription.trial_will_end` | 3 days before trial ends | Send reminder email to add card |
| `customer.subscription.updated` | Any subscription change | Sync `subscription_status` field |
| `customer.subscription.deleted` | Cancellation (including trial expiry) | Set `subscription_tier = 'free'`, clear `stripe_subscription_id` |
| `customer.subscription.paused` | Trial ended with `pause` setting | Set `subscription_status = 'paused'`, show "Add card to resume" UI |
| `invoice.payment_failed` | Dunning attempt failed | Set `subscription_status = 'past_due'`, send dunning email |

**Source:** [Use trial periods on subscriptions — Stripe Docs](https://docs.stripe.com/billing/subscriptions/trials)

---

### Pitfall 8: Webhook Idempotency — `customer.subscription.updated` Fires for Every Field Change

**What goes wrong:**

`customer.subscription.updated` fires for: trial start, trial end, plan change, payment method attachment, cancellation scheduling (`cancel_at_period_end = true`), proration creation, and more. If your handler executes a write on every delivery without checking for duplicates, Stripe's at-least-once delivery guarantee means you will write the same state multiple times. Worse: if events arrive out of order (Stripe does not guarantee ordering), a stale event can overwrite a newer state.

**Prevention — two-layer idempotency:**

Layer 1: Deduplication table.

```sql
CREATE TABLE stripe_webhook_events (
  event_id        TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL,
  processed_at    TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
const { error } = await supabase
  .from('stripe_webhook_events')
  .insert({ event_id: event.id, event_type: event.type });

if (error?.code === '23505') {
  return new Response('Already processed', { status: 200 }); // Return 200, not 4xx
}
```

Layer 2: Timestamp guard for subscription state writes. Only update `subscription_tier` if the event's `current_period_start` is newer than the stored `subscription_updated_at`:

```typescript
await supabase
  .from('trainer_profiles')
  .update({ subscription_tier: newTier, subscription_updated_at: periodStart })
  .eq('stripe_customer_id', customerId)
  .lt('subscription_updated_at', periodStart); // Only if incoming event is newer
```

Return `200` even for already-processed events. Non-2xx responses cause Stripe to retry.

---

### Pitfall 9: Proration Default Does Not Immediately Charge on Upgrades

**What goes wrong:**

A trainer upgrades from Pro to Elite on day 15 of their billing month. You expect them to be charged the $20 prorated difference immediately. Nothing happens. The trainer emails support asking if their card was charged.

**Why it happens:** Stripe's default `proration_behavior` is `create_prorations`. This creates a proration invoice item silently but does NOT immediately generate an invoice — it is collected at the next regular billing cycle.

**The three options:**

| `proration_behavior` | Effect | Use When |
|---|---|---|
| `create_prorations` (default) | Creates item; charges at next cycle | Acceptable to defer collection |
| `always_invoice` | Creates item AND immediately generates invoice | Upgrades — charge the difference now |
| `none` | No proration; full new price at next cycle | Simplicity over billing fairness |

**For FitRush:** Use `always_invoice` for upgrades; use `cancel_at_period_end` scheduling for downgrades.

```typescript
// Upgrade: charge the difference immediately
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: currentItemId, price: PRICE_ID_ELITE }],
  proration_behavior: 'always_invoice',
});

// Downgrade: schedule for end of period — do NOT use always_invoice
// (credit prorations would issue a refund invoice, which is confusing)
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true,
  // Then create a new subscription at the lower price when the old one deletes
});
// OR use Subscription Schedules for cleaner period-end plan changes
```

**Important:** Stripe does NOT automatically apply `cancel_at_period_end` for downgrades. A plan change is immediate by default unless you explicitly schedule otherwise. Decide this explicitly; do not accept defaults.

**Source:** [Prorations — Stripe Docs](https://docs.stripe.com/billing/subscriptions/prorations)

---

### Pitfall 10: Downgrade Data Integrity — Trainer Retains Elite Features After Tier Drops

**What goes wrong:**

When a trainer downgrades from Elite to Free, three things must happen atomically:
1. `subscription_tier` updated to `free`
2. Slot count visible to clients capped at 3 (others hidden, not deleted — they need them back if they re-upgrade)
3. Custom branding fields (`custom_bio_url`, `branding_color`) cleared

If the webhook handler only does step 1, the branded profile page continues displaying Elite elements and over-limit slots remain bookable. A client books slot #4 of a trainer who is now on Free — a booking that the trainer's current tier does not permit.

**Prevention:** The webhook handler or a DB trigger on `subscription_tier` change should:

```sql
CREATE OR REPLACE FUNCTION on_tier_downgrade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_tier = 'free' AND OLD.subscription_tier != 'free' THEN
    -- Clear Elite-only branding (data is gone; trainer must re-enter on re-upgrade)
    NEW.custom_bio_url := NULL;
    NEW.branding_color := NULL;
    -- Slots are NOT deleted; they are hidden by RLS slot limit policy
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tier_downgrade_cleanup
BEFORE UPDATE OF subscription_tier ON trainer_profiles
FOR EACH ROW EXECUTE FUNCTION on_tier_downgrade();
```

**Warning signs:**
- Webhook handler only updates `subscription_tier`, nothing else
- No migration plan for what happens to Elite-only profile fields on downgrade
- Slots can still be SELECTed by clients after tier drops (no RLS enforcement)

---

### Pitfall 11: Slot Limit Enforcement Is UI-Only

**What goes wrong:**

Free tier allows 3 visible slots. You enforce this by hiding the "Add slot" button after 3. A trainer uses the Supabase JS client directly (or inspects network calls) to POST a 4th slot. No DB constraint exists. The row inserts. Clients can book it.

**Prevention:** Enforce the slot count in a Postgres trigger at write time:

```sql
CREATE OR REPLACE FUNCTION enforce_slot_limit()
RETURNS TRIGGER AS $$
DECLARE
  trainer_tier TEXT;
  max_slots INT;
  current_count INT;
BEGIN
  SELECT subscription_tier INTO trainer_tier
    FROM trainer_profiles WHERE id = NEW.trainer_id;

  max_slots := CASE trainer_tier
    WHEN 'elite' THEN 999
    WHEN 'pro'   THEN 20
    ELSE 3  -- free and any unknown tier
  END;

  SELECT COUNT(*) INTO current_count
    FROM availability_slots WHERE trainer_id = NEW.trainer_id;

  IF current_count >= max_slots THEN
    RAISE EXCEPTION 'Slot limit reached for plan: %', trainer_tier
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_slot_limit
BEFORE INSERT ON availability_slots
FOR EACH ROW EXECUTE FUNCTION enforce_slot_limit();
```

Also: define precisely what "3 visible slots" means. Options: 3 total slots ever created, 3 slots visible to clients at any given time, 3 bookable slots per calendar day. This must be decided before the DB schema is locked — changing the semantics later is a migration.

---

### Pitfall 12: Dunning Default Behavior Is Not Configured — Status After Retry Exhaustion Is Unknown

**What goes wrong:**

Stripe Smart Retries will re-attempt a failed subscription payment for up to 2 weeks (default: 8 attempts). After all retries fail, the subscription transitions to one of three states: `canceled`, `unpaid`, or remains `past_due` — depending on your Stripe account's **Billing > Revenue recovery > Retries** configuration. Stripe does not have a universal default; new accounts may have a different default than accounts created years ago.

If your webhook handler only handles `customer.subscription.deleted` (which fires for `canceled`) but not `customer.subscription.updated` (which fires when status changes to `past_due` or `unpaid`), trainers who hit the `unpaid` path retain paid features indefinitely.

**Prevention:**

1. Go to Stripe Dashboard > Billing > Revenue recovery > Retries. Explicitly configure the final action to `cancel` (not `unpaid` or `past_due`). This ensures `customer.subscription.deleted` always fires at the end.

2. Even with cancellation configured, handle `invoice.payment_failed` defensively: immediately set `subscription_status = 'past_due'` in the DB on first failure. Do not wait for the subscription to reach `canceled` before restricting access.

```typescript
case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice;
  await supabase
    .from('trainer_profiles')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', invoice.customer as string);
  // Send dunning email to trainer
  break;
}
```

**Source:** [Automate payment retries — Stripe Docs](https://docs.stripe.com/billing/revenue-recovery/smart-retries)

---

### Pitfall 13: `cancel_at_period_end` Confusion — Wrong Event Handled

**What goes wrong:**

A trainer clicks "Cancel Plan." You call `stripe.subscriptions.update({ cancel_at_period_end: true })`. Stripe fires `customer.subscription.updated` (not `deleted`). Your webhook handler only listens for `customer.subscription.deleted` to downgrade to Free.

Result: the trainer keeps Pro for the rest of the billing period (correct behavior) but your UI still shows "Pro" with no cancellation indicator. They contact support thinking the cancel didn't work.

**The full cancel_at_period_end event sequence:**

| Event | When | What it Means |
|---|---|---|
| `customer.subscription.updated` (with `cancel_at_period_end: true`) | User clicks Cancel | Cancellation scheduled; access continues |
| `customer.subscription.deleted` | Billing period ends | Access revoked; downgrade to Free |

Handle both:

```typescript
case 'customer.subscription.updated': {
  const sub = event.data.object as Stripe.Subscription;
  if (sub.cancel_at_period_end) {
    // Show cancellation badge in UI; set subscription_cancels_at in DB
    await supabase
      .from('trainer_profiles')
      .update({ subscription_cancels_at: new Date(sub.cancel_at! * 1000).toISOString() })
      .eq('stripe_customer_id', sub.customer as string);
  }
  break;
}

case 'customer.subscription.deleted': {
  // This fires at actual period end when cancel_at_period_end was set
  // Also fires for immediate cancellations and trial expirations
  await supabase
    .from('trainer_profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      subscription_cancels_at: null,
    })
    .eq('stripe_customer_id', (event.data.object as Stripe.Subscription).customer as string);
  break;
}
```

---

### Pitfall 14: Annual-to-Monthly Downgrade Timing Is Ambiguous

**What goes wrong:**

A trainer on annual Elite ($348/yr) wants to switch to monthly Pro ($9/mo). If you do an immediate subscription update with `proration_behavior: 'create_prorations'`, they receive a large credit balance that takes 3+ months to exhaust while their monthly Pro charges try to draw from it. They see confusing invoice math.

If instead you use `cancel_at_period_end` without communicating the timing clearly, they think they're on monthly when they have 9 months of annual Elite remaining.

**Prevention:** Annual-to-monthly downgrades should be scheduled using Subscription Schedules to take effect at the next renewal date, not as an immediate update:

```typescript
const schedule = await stripe.subscriptionSchedules.create({
  from_subscription: subscriptionId,
});
await stripe.subscriptionSchedules.update(schedule.id, {
  phases: [
    {
      items: [{ price: PRICE_ID_ELITE_ANNUAL }],
      end_date: currentPeriodEnd,  // existing annual period
    },
    {
      items: [{ price: PRICE_ID_PRO_MONTHLY }],
      // No end_date = continues monthly thereafter
    },
  ],
});
```

Show clearly in the UI: "Your plan changes to Pro Monthly on [renewal date]. Until then, you have Elite access."

**Source:** [Subscription schedules — Stripe Docs](https://docs.stripe.com/billing/subscriptions/subscription-schedules)

---

### Pitfall 15: Multiple Webhook Endpoints Causing Double Processing (Staging vs. Production)

**What goes wrong:**

You have two billing webhook endpoints registered in the Stripe Dashboard: one pointing at production (`fitrush.app/webhooks/stripe-billing`) and one at a Netlify preview URL. A real production payment event fires; both endpoints receive it. Both handlers fire. One updates the production DB; the other updates nothing (staging DB) — but the idempotency table in production has now recorded the event as processed, so if the production handler had an error, the event will not be re-delivered successfully.

**Prevention:**

- Use separate Stripe accounts (or separate restricted API keys) for staging and production.
- Webhook secrets are per-endpoint, not per-account — each endpoint has its own `whsec_*`.
- In staging, use `stripe listen --forward-to` locally rather than registering a remote webhook for every PR preview.
- Add a livemode guard in the handler:

```typescript
if (event.livemode !== (process.env.NODE_ENV === 'production')) {
  console.warn('Livemode mismatch — ignoring event');
  return new Response('OK', { status: 200 });
}
```

---

### Pitfall 16: Annual Subscription Cancellation — Credit vs. Refund Confusion

**What goes wrong:**

A trainer pays $348/yr upfront for annual Elite, cancels 2 months in. Stripe creates a proration credit on their customer account. This credit is applied to future invoices. But if there are no future invoices (subscription canceled), the credit is stranded. The trainer sees "you have a $231 credit" in any Stripe-hosted billing portal but cannot access it. They open a dispute.

**Stripe's default:** Stripe does not automatically issue prorated cash refunds on annual subscription cancellations. Credit prorations and cash refunds are different things.

**Prevention:**

- Define and document your annual refund policy before launch. Surface it at checkout.
- If you offer prorated refunds programmatically: `stripe.refunds.create({ payment_intent: invoice.payment_intent, amount: proratedAmount })`.
- For annual dunning: a failed $348 renewal is materially different from a failed $9 charge. Configure more aggressive advance warning emails (30 / 14 / 7 days before renewal) and consider a more lenient retry window for annual subscribers.

---

### Pitfall 17: Admin Override Tier With No Stripe Subscription Creates Orphaned State

**What goes wrong:**

You manually set `subscription_tier = 'elite'` in the Supabase dashboard for a beta tester. No Stripe subscription exists. Your nightly reconciliation job queries `WHERE subscription_status = 'active' AND stripe_subscription_id IS NOT NULL` and finds nothing — the trainer is silently downgraded. Or: a webhook handler for an unrelated event checks "does this trainer have an active subscription?" sees none, and resets their tier to `free`.

**Prevention:** Create an explicit override pattern the system understands and respects:

```sql
ALTER TABLE trainer_profiles
  ADD COLUMN tier_override         TEXT CHECK (tier_override IN ('free', 'pro', 'elite')),
  ADD COLUMN tier_override_expires TIMESTAMPTZ,
  ADD COLUMN tier_override_reason  TEXT;
```

Effective tier resolution (call this everywhere tier is consumed):

```typescript
function effectiveTier(trainer: TrainerProfile): Tier {
  if (
    trainer.tier_override &&
    (!trainer.tier_override_expires || trainer.tier_override_expires > new Date())
  ) {
    return trainer.tier_override;
  }
  return trainer.subscription_tier ?? 'free';
}
```

The webhook handler only writes `subscription_tier`, never `tier_override`. Admin tools only write `tier_override`. The columns are categorically distinct. Reverting an override is `UPDATE SET tier_override = NULL`.

---

### Pitfall 18: Grandfathered Trainers Have No Defined Starting Tier

**What goes wrong:**

Tiers launch. Existing trainers who joined before tiers existed suddenly cannot access features they have been using freely. Support tickets spike. A trainer with 50 reviews and 200 bookings discovers their profile is now "Free" with 3 slots.

**Prevention:** Decide explicitly before launch. Two reasonable options:

- **Option A (recommended):** All existing trainers start on Free. Grant a 30-day grace period where they retain current behavior. Set `tier_grace_until = NOW() + INTERVAL '30 days'`. RLS policies treat any trainer with `tier_grace_until > NOW()` as Pro-equivalent. Send email explaining the change and the grace period.

- **Option B:** Grandfather all trainers created before a cutoff date into Pro indefinitely. Set `tier_override = 'pro'` with no expiration for all such trainers.

Either way, communicate before the cutoff. Surprise tier changes are the fastest path to negative App Store reviews.

---

### Pitfall 19: Booking Race Condition When Trainer Upgrades Mid-Booking

**What goes wrong:**

Client A begins booking slot #4 of trainer B (Free tier — slot should be invisible). Simultaneously, trainer B upgrades to Pro. The slot visibility check reads "Free, slot #4 not visible" but the UI had already loaded the slot list under the old tier. The booking proceeds against ambiguous state.

**Prevention:** The booking Edge Function must be the authoritative gate. Fetch the trainer's tier inside the same DB transaction as the booking:

```typescript
// Inside booking Edge Function — Supabase transaction
const { data: trainer } = await supabase
  .from('trainer_profiles')
  .select('subscription_tier, subscription_status')
  .eq('id', trainerId)
  .single();  // Fresh DB read, not from client

const slotLimit = tierSlotLimit(trainer.subscription_tier);
if (slotIndex > slotLimit) {
  throw new Error(`Slot ${slotIndex} exceeds plan limit of ${slotLimit}`);
}
// Proceed with booking atomically
```

The client's slot list is always stale by definition. The server is the source of truth.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | Acceptable? |
|---|---|---|---|
| Store tier in Zustand only, not re-verified server-side | Simpler code | Lapsed subscriptions retain access until page reload | Never |
| Single webhook endpoint with no secret routing | Less config | Billing events fail signature verification | Never |
| No idempotency table | Faster to ship | Duplicate events cause double-execution | Never |
| Skip `missing_payment_method` config | Less code | Trial end behavior is undefined | Never |
| Tier check in React component only | Faster UI | Bypassed by any direct API call | Never |
| Prorate downgrades with `always_invoice` | Simple default | Surprise credit invoices; support volume spike | Avoid — use period-end scheduling |
| No audit log on tier changes | Simpler schema | Cannot debug billing anomalies or dispute chargebacks | Avoid — add `subscription_tier_history` or event log |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| DB schema design | Conflating `acct_*` with `cus_*` | Two separate columns; DB check constraint on format |
| Webhook setup | Using Connect secret for Billing events | Separate endpoint, separate env var |
| Webhook handler | Global JSON parsing breaking signature | `request.text()` not `request.json()` |
| Trial creation | Not setting `missing_payment_method` | Always explicit; test the no-card path |
| Feature gates | Client-side Zustand check | RLS policies + Edge Function checks; test via direct API |
| JWT claims | Tier in JWT goes stale for 1h | Query DB via `auth.uid()` in RLS; do not embed tier in claims |
| Upgrade flow | Expecting immediate charge | Use `proration_behavior: 'always_invoice'` for upgrades |
| Downgrade flow | Unclear when new tier takes effect | Explicit `cancel_at_period_end`; handle both `updated` and `deleted` events |
| Admin tools | Manual tier set without Stripe subscription | Separate `tier_override` column; webhook never touches it |
| Slot enforcement | UI-only slot limit | Postgres trigger at write time |
| Dunning config | Unknown final action on retry exhaustion | Explicitly set to `cancel` in Stripe Dashboard |
| Annual billing | Large charge dunning; credit vs. refund confusion | Define refund policy; advance email warnings |
| Multi-env webhooks | Staging consuming prod events | Separate Stripe accounts; `livemode` guard |
| Grandfathering | Existing users lose access at launch | Grace period with `tier_grace_until` column |

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Billing events dropped (wrong webhook secret) | MEDIUM | Re-register endpoint in Stripe Dashboard; reconcile against Stripe Events API; backfill tier state |
| `past_due` trainers retaining paid features | MEDIUM | One-time script: fetch all subscriptions from Stripe, compare to DB, downgrade mismatches |
| No idempotency — duplicate tier writes | LOW | Add `stripe_webhook_events` table retroactively; replay recent events via Stripe event log |
| Elite branding fields not cleared on downgrade | LOW | Migration: NULL `custom_bio_url` and `branding_color` where `subscription_tier != 'elite'` |
| Trial abuse (multiple accounts) | HIGH | Cannot claw back consumed trial value; add phone verification prospectively |
| Annual cancellation credit stranded | MEDIUM | Manual refund issuance; add prorated refund logic in cancellation flow |

---

## Sources

- [Charge SaaS fees to your connected accounts — Stripe Docs](https://docs.stripe.com/connect/integrate-billing-connect) — HIGH confidence
- [Create subscriptions with Stripe Billing (Connect) — Stripe Docs](https://docs.stripe.com/connect/subscriptions) — HIGH confidence
- [How subscriptions work — Stripe Docs](https://docs.stripe.com/billing/subscriptions/overview) — HIGH confidence
- [Use trial periods on subscriptions — Stripe Docs](https://docs.stripe.com/billing/subscriptions/trials) — HIGH confidence
- [Prorations — Stripe Docs](https://docs.stripe.com/billing/subscriptions/prorations) — HIGH confidence
- [Cancel subscriptions — Stripe Docs](https://docs.stripe.com/billing/subscriptions/cancel) — HIGH confidence
- [Automate payment retries (Smart Retries) — Stripe Docs](https://docs.stripe.com/billing/revenue-recovery/smart-retries) — HIGH confidence
- [Subscription schedules — Stripe Docs](https://docs.stripe.com/billing/subscriptions/subscription-schedules) — HIGH confidence
- [Receive Stripe events in your webhook endpoint — Stripe Docs](https://docs.stripe.com/webhooks) — HIGH confidence
- [Resolve webhook signature verification errors — Stripe Docs](https://docs.stripe.com/webhooks/signature) — HIGH confidence
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [Stripe API: Subscription status explained — mrcoles.com](https://mrcoles.com/stripe-api-subscription-status/) — MEDIUM confidence (community, consistent with official docs)
- [Billing webhook race condition solution guide — excessivecoding.com](https://excessivecoding.com/blog/billing-webhook-race-condition-solution-guide) — MEDIUM confidence (community pattern)
- [Stripe Webhooks: Solving Race Conditions — Pedro Alonso](https://www.pedroalonso.net/blog/stripe-webhooks-solving-race-conditions/) — MEDIUM confidence (community, consistent with official guidance)

---

*Domain pitfalls research for: FitRush v2.1 — Stripe Billing subscription tiers on existing Stripe Connect Express marketplace*
*Researched: 2026-03-15*
