# Pitfalls Research

**Domain:** Adding Stripe Billing (subscription tiers) to an existing Stripe Connect fitness marketplace
**Researched:** 2026-03-15
**Confidence:** HIGH — primary sources are Stripe official documentation, supplemented by community verification

---

## Critical Pitfalls

### Pitfall 1: Billing Customer Object vs. Connect Account — Two Separate Identity Systems

**What goes wrong:**

Developers assume the existing `stripe_account_id` stored in `trainer_profiles` is sufficient for billing. It is not. A Connect Account object (used for payouts and destination charges) is a _merchant_ identity. A Billing Customer object (used for subscriptions) is a _consumer_ identity. They are completely separate objects in Stripe's data model.

In FitRush, `trainer_profiles.stripe_account_id` is the trainer's Express account for receiving payouts. To charge that trainer a subscription fee, the platform must create a **separate** `Customer` object on the platform account representing the trainer. Without this, subscription creation will fail with `No such customer`.

**Why it happens:**

The Stripe dashboard shows both objects but developers conflate "the trainer has a Stripe account" with "the trainer is a Stripe customer of my platform." They are orthogonal concepts. Stripe's own documentation states: _"The Account object allows the connected account to collect payments from its customers, but the platform can't use it to collect recurring payments from the connected account."_

**How to avoid:**

Create a `stripe_customer_id` column on `trainer_profiles` (separate from `stripe_account_id`). On first subscription checkout, call `stripe.customers.create()` using the platform's secret key (not a connected account key), store the resulting `cus_*` ID, and reuse it for all future subscription operations. Never pass a `acct_*` ID where a `cus_*` is expected.

**Warning signs:**

- Stripe returns `No such customer` errors when creating subscriptions
- Code that passes `stripe_account_id` directly to `stripe.subscriptions.create({ customer: ... })`
- `trainer_profiles` table has no `stripe_customer_id` column after billing is implemented

**Phase to address:** Stripe Billing setup phase (database migration + checkout session creation)

---

### Pitfall 2: Webhook Secret Collision — Using the Connect Webhook Secret for Billing Events

**What goes wrong:**

FitRush currently has one webhook endpoint (`stripe-webhook`) using `STRIPE_WEBHOOK_SECRET` to verify signatures. This secret is tied to the Connect webhook endpoint configured in the Stripe dashboard.

Billing subscription events (`customer.subscription.*`, `invoice.*`) originate from the **platform account**, not from connected accounts. If those events are routed to the same endpoint but verified with the Connect webhook secret, `stripe.webhooks.constructEvent()` will throw a signature mismatch error and all billing events will be silently dropped (the function returns 400).

**Why it happens:**

Developers register one webhook URL in Stripe's dashboard, check a handful of event types, and don't realize that Stripe uses separate signing secrets per endpoint. The Connect endpoint's secret and the platform account's billing endpoint secret are different `whsec_*` values.

**How to avoid:**

Create a **second** webhook endpoint in the Stripe dashboard specifically for billing events on the platform account. Store its secret as `STRIPE_BILLING_WEBHOOK_SECRET`. Route billing events to a separate Edge Function (`stripe-billing-webhook`) or add routing logic at the top of the existing handler that inspects `event.account`: if `event.account` is set, it is a Connect event; if it is absent, it is a platform/billing event. Use the corresponding secret for verification.

**Warning signs:**

- `stripe-webhook` logs showing 400 errors after billing is wired up
- Subscription status in the database never updating despite confirmed Stripe payments
- `constructEvent` throwing `No signatures found matching the expected signature for payload`

**Phase to address:** Webhook routing phase (must be addressed before any billing event handling is written)

---

### Pitfall 3: Trial End With No Payment Method — Subscription Enters `past_due` Silently

**What goes wrong:**

FitRush's 30-day trial requires no card upfront. When the trial ends, Stripe generates an invoice and attempts to charge it. With no payment method on the Customer, the charge fails immediately. The subscription transitions to `past_due`. Unless the webhook handler explicitly listens for `invoice.payment_failed` and updates the local `subscription_tier` back to `free`, the trainer's DB record still shows `pro` or `elite`. They retain gated features for free indefinitely.

The default behavior (not setting `trial_settings[end_behavior][missing_payment_method]`) is to invoice and fail — not to cancel. The subscription does not self-cancel; it lingers in `past_due` and then `unpaid` as Stripe retries.

**Why it happens:**

Developers test the happy path (card added before trial ends) and never test the no-card path. They also assume Stripe cancels automatically, when in reality cancellation requires explicit configuration or webhook-driven revocation.

**How to avoid:**

Two complementary defenses:

1. Set `trial_settings.end_behavior.missing_payment_method = 'cancel'` on subscription creation. This instructs Stripe to cancel (rather than invoice) when the trial ends with no card, firing `customer.subscription.deleted`.

2. In the webhook handler, handle `invoice.payment_failed` and `customer.subscription.updated` (to `past_due`/`unpaid` status): immediately downgrade the trainer's `subscription_tier` to `free` in the database.

**Warning signs:**

- Trainer has `subscription_tier = 'pro'` in DB but `stripe_subscription_status = 'past_due'`
- No `invoice.payment_failed` handler in `stripe-billing-webhook`
- Trial-end webhook events (`customer.subscription.trial_will_end`) not triggering email reminders to add card

**Phase to address:** Subscription creation phase (set `trial_settings` parameter) + webhook handling phase (handle `invoice.payment_failed`)

---

### Pitfall 4: Feature Gate Enforcement Is Client-Side Only

**What goes wrong:**

The most common implementation pattern is: read `trainer.subscription_tier` from Zustand auth store, render "3 slots" if free, "10 slots" if pro, "unlimited" if elite. This is purely cosmetic. An authenticated user can call the Supabase REST API directly, bypassing the React UI entirely, and retrieve all slots for any trainer — or modify their own `subscription_tier` via the REST API if RLS policies are absent.

FitRush already has a documented security concern: "Verify and harden RLS policies across all tables." Adding subscription tiers without server-side enforcement compounds this debt.

**Why it happens:**

Feature gating is built as a UI concern first because it ships quickly. The developer sees the UI working and considers the feature done. The actual enforcement — an RLS policy or Edge Function check that the tier is respected — is treated as a follow-up.

**How to avoid:**

Enforce at the data layer, not the UI layer:

- **Slot visibility:** The `availability_slots` RLS SELECT policy for client users should call a Postgres function that checks the trainer's tier and applies the slot limit (3/10/unlimited). The limit is enforced in SQL regardless of how the client queries.
- **Analytics endpoints:** The RPCs `get_trainer_analytics` and `get_trainer_analytics_trend` should check `subscription_tier` inside the function body and return only basic stats for `free` callers.
- **Profile customization fields:** `custom_bio_url` and `branding_color` should have a CHECK constraint or trigger that NULLifies them if the trainer's tier is downgraded.
- **Admin override write path:** Only service-role clients (Edge Functions) should be able to write `subscription_tier`; the column should not be writable via RLS for authenticated users.

**Warning signs:**

- `subscription_tier` is a plain writable column with no RLS restriction on UPDATE
- Slot count limit is only applied in the React component, not in the Supabase query or RLS policy
- No test confirming that a free-tier trainer cannot retrieve more than 3 slots via direct API call

**Phase to address:** Database migration phase (RLS policies) — must be done before the billing UI is built, not after

---

### Pitfall 5: Webhook Idempotency — `customer.subscription.updated` Fires Multiple Times

**What goes wrong:**

Stripe guarantees at-least-once delivery. `customer.subscription.updated` fires for every subscription field change: trial start, trial end, plan change, payment method attachment, cancellation scheduling, and more. If the webhook handler executes a write operation without checking whether it already processed this event or state, it can fire multiple redundant DB updates — or worse, toggle a trainer's tier down and then back up within seconds if events arrive out of order.

**Why it happens:**

Developers write a handler that checks `event.type === 'customer.subscription.updated'` and immediately writes the new tier. They do not check: has this event ID already been processed? Is this event's `current_period_end` newer than what we already have?

**How to avoid:**

Two-layer idempotency:

1. **Event deduplication table:** A `processed_stripe_events` table with a `stripe_event_id` unique column. At the start of each handler, attempt an INSERT. If it conflicts, the event was already processed — return 200 immediately. This is the standard Stripe recommendation.

2. **State-based guard:** For `customer.subscription.updated`, only write to `subscription_tier` if the incoming event's `current_period_start` timestamp is greater than or equal to the stored `subscription_updated_at`. This prevents out-of-order events from reverting a more recent state.

**Warning signs:**

- No `processed_stripe_events` table in the schema
- Webhook handler updates DB unconditionally on every `customer.subscription.updated` event
- No timestamp comparison before writing tier changes

**Phase to address:** Webhook handling phase (before any subscription state writes are implemented)

---

### Pitfall 6: Downgrade Data Integrity — Trainer Retains Features After Tier Drops

**What goes wrong:**

When a trainer downgrades from Elite to Free mid-month, three things must happen atomically:
1. `subscription_tier` is updated to `free`
2. Slot count visible to clients is restricted to 3 (others become invisible, not deleted)
3. Custom branding fields (`custom_bio_url`, `branding_color`) are cleared

If only step 1 is handled in the webhook, steps 2 and 3 are silently skipped. The trainer's branded profile page continues to display Elite-tier elements. Their slots beyond the 3-slot free cap remain bookable by clients. The slot over-limit is a data integrity issue: a client could book a slot the trainer's current tier does not allow to be visible.

**Why it happens:**

Developers implement the webhook handler to only update `subscription_tier`. The downstream consequences (slot visibility, profile field cleanup) are handled by the UI and considered "someone else's problem" when the tier changes.

**How to avoid:**

Implement a Postgres function (called via a DB trigger on `subscription_tier` change or called explicitly from the webhook Edge Function) that:
- Sets `custom_bio_url = NULL` and `branding_color = NULL` when tier drops below elite
- Does NOT delete slots — soft-hides them via a `tier_visible` boolean or relies on the RLS slot limit. Deletion causes data loss if the trainer later re-upgrades.
- Sends an in-app notification to the trainer explaining what changed

**Warning signs:**

- Webhook handler only updates `subscription_tier`, nothing else
- No migration plan for what happens to Elite-only profile fields on downgrade
- Slot visibility is purely RLS-based with no event emitted on tier change

**Phase to address:** Downgrade/cancellation handling phase

---

### Pitfall 7: Featured Placement Ordering — No Tiebreaker for Multiple Elite Trainers

**What goes wrong:**

The landing page "Featured Trainers" section shows Elite-tier trainers. With one Elite trainer this works. With five, there is no defined order. The query defaults to `created_at` insertion order or random, making placement unpredictable and potentially unfair. Trainers paying $29/month expect consistent premium visibility; arbitrary ordering erodes the value proposition.

**Why it happens:**

The initial implementation renders whatever the query returns without explicit ordering. Tiebreaker logic is deferred as a "later problem."

**How to avoid:**

Define a deterministic Featured sort order at implementation time. A reasonable default: `ORDER BY rating DESC, review_count DESC, created_at ASC`. This rewards quality first, then tenure. Document this in the UI so Elite trainers know what drives their relative placement. Alternatively, introduce a weighted score column updated by the existing analytics RPC and sort on that.

**Warning signs:**

- Landing page query fetches `subscription_tier = 'elite'` with no `ORDER BY` clause
- No product definition of "what determines relative ordering among Elite trainers"

**Phase to address:** Landing page featured section phase

---

### Pitfall 8: Trial Abuse — Repeated Free Trials via New Accounts

**What goes wrong:**

FitRush uses Google/Facebook/Apple OAuth. A trainer can create multiple OAuth accounts with different email aliases (e.g., Gmail `+` aliases) or burner accounts. Each new account gets a fresh 30-day trial. With enough accounts, a trainer never pays.

Stripe's own fraud analysis (published November 2025) flagged a "significant increase in abusive free trials" as a broader trend in first-party fraud. Stripe Radar has a native trial abuse control, but it only applies if the trainer submits a payment method at trial signup (Radar evaluates the card). FitRush's no-card trial bypasses Radar entirely.

**Why it happens:**

No-card trials are intentionally frictionless. The abuse vector is the direct consequence of frictionless signup with OAuth.

**How to avoid:**

Layered prevention — implement at least two:

1. **Phone verification at trial start.** Require SMS verification before activating the trial. Phone numbers are harder to create in bulk than email aliases. Store `phone_verified_at` on the profile.
2. **One-trial-per-device fingerprint.** Use a browser fingerprinting signal (device ID stored in a cookie or localStorage) to flag if this device has started a trial before. Soft-block: show friction, not hard error.
3. **Stripe Radar customer abuse evaluation.** Even without a card, create the Customer object with `email` and `metadata` (IP, device ID) so Radar can evaluate the risk score. Check `customer.abuse_evaluation.risk_score` before activating the trial.
4. **Admin manual review for flagged accounts.** The admin UI should surface `subscription_tier = 'pro|elite'` trainers with `trial_end` approaching but no payment method attached.

**Warning signs:**

- No `phone_verified` check before trial activation
- No unique constraint or check preventing the same Supabase user from starting multiple trials (though this is naturally prevented per-user; the risk is multiple users from same actor)
- No monitoring for trainers with 0 bookings and multiple profile recreations

**Phase to address:** Subscription creation phase (trial activation gate) + admin monitoring phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store tier in Zustand only, not re-verified on each request | Faster UI, simpler code | Trainers with lapsed subscriptions retain access until next page load | Never — must be in DB, verified server-side |
| Single webhook endpoint with no routing | Less infrastructure to manage | Billing events fail signature verification with Connect secret | Never — use separate secrets or routing logic |
| Soft-delete `subscription_tier` changes without audit log | Simpler schema | Impossible to dispute billing, debug anomalies, or recover from bugs | Never — add `subscription_tier_history` or use `updated_at` + event log |
| Prorate downgrades immediately | Simplest default | Trainer receives surprise credit/charge mid-month, high support volume | Acceptable if downgrade is scheduled at `period_end` instead |
| Skip idempotency table for MVP | Faster to ship | Duplicate events cause double-execution of tier changes | Never — idempotency table is trivial to add |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Billing + Connect | Pass `acct_*` as customer ID for subscriptions | Create a separate `cus_*` Customer on the platform account; store as `stripe_customer_id` |
| Stripe webhooks | Use Connect webhook secret for billing events | Create a second endpoint for platform billing events; use its separate `whsec_*` secret |
| Stripe trial settings | Omit `trial_settings.end_behavior.missing_payment_method` | Always set to `'cancel'` for no-card trials to avoid lingering `past_due` subscriptions |
| Stripe proration | Default `create_prorations` accumulates silently | Preview proration before confirming upgrade; show trainer the amount before charging |
| Supabase RLS | Gate slots in React component only | Add RLS policy on `availability_slots` that enforces the per-tier slot limit in SQL |
| Stripe annual billing | Upgrade from monthly to annual bills full year immediately | Show proration preview; warn trainer before confirming annual commitment |
| `customer.subscription.updated` | Handle unconditionally | Check `event.id` against `processed_stripe_events` table first; check timestamps before writing |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Landing page featured query with no index on `subscription_tier` | Slow featured section as trainer count grows | Add `CREATE INDEX idx_trainer_profiles_tier ON trainer_profiles(subscription_tier)` | ~500 trainers |
| Checking `subscription_tier` via JOIN on every availability slot query | Slow slot fetches as slot count grows | Denormalize tier check into RLS policy using a fast profile lookup; cache in JWT claims | ~10K slots |
| Polling Stripe API for subscription status instead of webhook-driven updates | Rate limit errors, stale data | Trust webhook state; poll only for admin-initiated reconciliation | ~100 req/min sustained |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `subscription_tier` column writable via RLS for authenticated trainer | Trainer self-upgrades to elite for free by PATCHing their own profile | Set UPDATE policy to only allow service-role; write tier exclusively from Edge Functions |
| Feature gate in React only (no server enforcement) | Authenticated API calls bypass UI limits | RLS policies + Edge Function checks enforce limits independent of UI |
| Using `SUPABASE_ANON_KEY` client in billing webhook handler | Subscription status writes bypass RLS correctly but fail silently if RLS blocks | Use `SUPABASE_SERVICE_ROLE_KEY` in webhook Edge Functions for all subscription state writes |
| Not verifying JWT in the `create-subscription` Edge Function | Any unauthenticated caller can create subscriptions for arbitrary customers | Follow same `userClient.auth.getUser()` pattern already used in `create-payment-intent` |
| Storing full Stripe Customer ID in a client-accessible field without RLS | Allows enumeration of customer IDs across trainers | Ensure `stripe_customer_id` is not SELECTable by other users via RLS |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No proration preview before upgrade confirmation | Trainer confused by unexpected charge on next invoice | Show `stripe.invoices.retrieveUpcoming()` preview before confirming plan change |
| Immediate feature revocation on cancellation vs. end of period | Trainer cancels and loses features immediately despite having paid through month end | Set `cancel_at_period_end = true`; revoke access only on `customer.subscription.deleted` event |
| No email when trial is 3 days from ending and no card added | Trainer loses trial silently, assumes platform charged them | Listen to `customer.subscription.trial_will_end`; send email prompting card addition |
| Downgrade confirmation with no summary of what is lost | Trainer downgrades not understanding they lose Elite branding and unlimited slots | Pre-downgrade modal listing specifically what changes (slots, branding, search rank) |
| Annual plan selected without showing monthly equivalent | Trainer doesn't understand the $276/year vs $29/month tradeoff | Show "equivalent to $23.20/month, billed annually" alongside annual price |

---

## "Looks Done But Isn't" Checklist

- [ ] **Stripe Customer creation:** Verify `stripe_customer_id` is created and stored before subscription creation — not assumed to exist
- [ ] **Webhook routing:** Verify billing events are verified with the billing endpoint's secret, not the Connect endpoint's secret
- [ ] **Trial end no-card path:** Verify subscription is cancelled (not `past_due`) when trial ends with no payment method — test this path explicitly
- [ ] **Feature gate server enforcement:** Verify a free-tier trainer cannot retrieve more than 3 slots by calling the Supabase REST API directly (no UI)
- [ ] **Downgrade cleanup:** Verify Elite branding fields are nulled and slot count is restricted when tier drops — not just when the page re-renders
- [ ] **Idempotency table:** Verify `processed_stripe_events` table exists and is checked before every state write in billing webhook handler
- [ ] **Webhook secret separation:** Verify `STRIPE_BILLING_WEBHOOK_SECRET` is a different value from `STRIPE_WEBHOOK_SECRET` in Supabase secrets
- [ ] **Admin manual override writes only through service-role path:** Verify trainer cannot PATCH their own `subscription_tier` via the REST API
- [ ] **Annual billing proration preview:** Verify upgrade from monthly Pro to annual Elite shows the trainer the exact charge before confirming

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Billing events dropped due to wrong webhook secret | MEDIUM | Re-register billing endpoint in Stripe Dashboard; store new secret; reconcile subscription state against Stripe API via admin script |
| Trainers with `past_due` subscriptions still showing Pro/Elite features | MEDIUM | Write one-time reconciliation script: fetch all subscriptions from Stripe API, compare to DB tier, downgrade mismatches; add monitoring |
| `subscription_tier` written without idempotency, causing duplicates | LOW | Add `processed_stripe_events` table retroactively; re-process recent events via Stripe event log replay |
| Elite branding fields not cleared on downgrade | LOW | One-time migration to NULL `custom_bio_url` and `branding_color` for all trainers where `subscription_tier != 'elite'` |
| Trial abuse with multiple accounts | HIGH | Retroactive: cannot easily claw back trial value already consumed. Prospective: add phone verification and rate-limit trial activation per IP |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Billing vs Connect customer object confusion | Database migration (add `stripe_customer_id`) + subscription creation Edge Function | Verify `trainer_profiles` has `stripe_customer_id` column; verify subscription creation uses `cus_*` not `acct_*` |
| Webhook secret collision | Webhook routing setup (before any billing events handled) | Verify two distinct webhook endpoints in Stripe Dashboard with different secrets |
| Trial end no-card — `past_due` retention | Subscription creation (set `trial_settings`) + billing webhook handler (`invoice.payment_failed`) | Integration test: create trial with no card, advance clock past trial_end, verify DB tier = `free` |
| Feature gate bypass | Database migration phase (RLS policies on `availability_slots`, `trainer_profiles`) | Directly call Supabase REST API as free-tier trainer; assert slot count <= 3 |
| Webhook idempotency | Billing webhook handler phase | Send same billing event twice; verify DB is not double-updated |
| Downgrade data integrity | Downgrade handling (webhook + DB trigger/function) | Downgrade Elite to Free; verify branding fields are NULL and slot cap is enforced |
| Featured placement ordering | Landing page featured section | Query returns deterministic order with 3+ Elite trainers |
| Trial abuse | Subscription activation gate | Manual test: attempt second trial on same device/IP |

---

## Sources

- [Use trial periods on subscriptions — Stripe Documentation](https://docs.stripe.com/billing/subscriptions/trials) — HIGH confidence
- [Create subscriptions with Stripe Billing (Connect) — Stripe Documentation](https://docs.stripe.com/connect/subscriptions) — HIGH confidence
- [Connect webhooks — Stripe Documentation](https://docs.stripe.com/connect/webhooks) — HIGH confidence
- [Using webhooks with subscriptions — Stripe Documentation](https://docs.stripe.com/billing/subscriptions/webhooks) — HIGH confidence
- [Prorations — Stripe Documentation](https://docs.stripe.com/billing/subscriptions/prorations) — HIGH confidence
- [Customer abuse evaluation — Stripe Documentation](https://docs.stripe.com/radar/customer-abuse) — HIGH confidence
- [Analyzing first-party fraud trends: Account, free trial, and refund abuse — Stripe Blog](https://stripe.com/blog/analyzing-first-party-fraud-trends-account-free-trial-and-refund-abuse) — HIGH confidence
- [Compare SaaS platform configurations for Accounts v1 and v2 — Stripe Documentation](https://docs.stripe.com/connect/accounts-v2/saas-platform-payments-billing) — HIGH confidence
- [Stripe subscription states explained — mrcoles.com](https://mrcoles.com/stripe-api-subscription-status/) — MEDIUM confidence (community, consistent with official docs)
- [Building Reliable Stripe Subscriptions in NestJS: Webhook Idempotency — DEV Community](https://dev.to/aniefon_umanah_ac5f21311c/building-reliable-stripe-subscriptions-in-nestjs-webhook-idempotency-and-optimistic-locking-3o91) — MEDIUM confidence (community, consistent with official guidance)

---

*Pitfalls research for: Stripe Billing subscription tiers on FitRush (existing Stripe Connect marketplace)*
*Researched: 2026-03-15*
