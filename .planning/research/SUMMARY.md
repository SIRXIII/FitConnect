# Research Summary

**Project:** FitRush v2.1 — Subscription Tiers (Free / Pro $9/mo / Elite $29/mo)
**Domain:** Stripe Billing + feature gating on existing Stripe Connect fitness marketplace
**Researched:** 2026-03-15
**Confidence:** HIGH (all primary sources are official Stripe documentation)

---

## Executive Summary

FitRush v2.1 adds trainer-facing subscription tiers to an existing production platform (React 19, Supabase, Stripe Connect Express, 10 Edge Functions, 14 migrations). The core challenge is that Stripe uses two completely separate identity models: a Connect Account (`acct_`) for trainers receiving payouts, and a Billing Customer (`cus_`) for trainers paying the platform subscription fee. These are orthogonal objects and both must exist. The approved pattern for v1 Express accounts — which cannot migrate to Accounts v2 without destroying existing payout relationships — is to create a separate `stripe_customer_id` per trainer on the platform account. This requires one new DB column, two new Edge Functions, and an extension of the existing `stripe-webhook` function.

The recommended implementation approach minimizes custom code: use Stripe's native trial mechanics (`trial_period_days: 30`, `payment_method_collection: 'if_required'`, `trial_settings.end_behavior.missing_payment_method: 'cancel'`) for the no-card trial, and delegate all post-subscription management (upgrade, downgrade, cancel, payment method update, invoices) to the Stripe Billing Customer Portal. Feature gating requires no third-party service — a `subscription_tier` column on `trainer_profiles`, written exclusively by the webhook handler, is the single source of truth. The frontend reads it via an existing Zustand/profile query, gates via a `<FeatureGate>` component, and all hard limits (slot counts, analytics access) are enforced server-side in DB functions and RLS.

The top risks are all preventable with correct initial setup: (1) webhook secret collision — billing events need their own endpoint secret or explicit routing logic distinct from the existing Connect webhook secret; (2) trial-end silent retention — must set `trial_settings.end_behavior.missing_payment_method: 'cancel'` and handle `invoice.payment_failed` in the webhook to prevent `past_due` trainers retaining Pro/Elite features; (3) client-side-only feature gates — `subscription_tier` must be enforced in SQL (`get_visible_slots` RPC, analytics RPC) not just in React. All three are cheapest to get right at implementation time; retroactive fixes require reconciliation scripts and data audits.

---

## Confirmed Approach

Research across all 4 files converges on the same decisions. These are not open questions.

| Decision | Confirmed Approach | Why |
|----------|-------------------|-----|
| Stripe object model | Separate `stripe_customer_id` (`cus_`) per trainer, distinct from `stripe_account_id` (`acct_`) | v1 Express accounts cannot use Accounts v2; separate Customer is the documented v1 pattern |
| Subscription management UI | Stripe Billing Customer Portal for all post-signup flows | Handles proration, 3DS, card updates, cancel confirmation for free |
| Trial mechanics | `trial_period_days: 30` + `payment_method_collection: 'if_required'` + `end_behavior: 'cancel'` | No zombie `past_due` subscriptions; clean cancel if no card added |
| Feature gate storage | `subscription_tier` column on `trainer_profiles`, webhook-written only | Already in DB; no external service needed; supports RLS |
| Webhook handling | Extend existing `stripe-webhook` function with new `case` blocks | Same Supabase client setup; same auth pattern; `switch(event.type)` scales cleanly |
| Webhook secret | Separate secret for billing endpoint (`STRIPE_BILLING_WEBHOOK_SECRET`) or explicit `event.account` routing | Connect events have `event.account`; billing events do not — use this to route |
| Idempotency | `subscription_events` table with `stripe_event_id UNIQUE` constraint; INSERT-first pattern | Standard Stripe recommendation; prevents double-writes on at-least-once delivery |
| Annual discount | Separate Price objects per interval (4 prices: Pro monthly/annual, Elite monthly/annual) | Cleaner than coupons; each price ID is unambiguous |
| Downgrade behavior | `cancel_at_period_end: true`; access revoked only on `customer.subscription.deleted` | FTC Click-to-Cancel compliance; no mid-cycle access revocation |
| Slot enforcement | `get_visible_slots(p_trainer_id)` SQL function enforcing 3/10/unlimited per tier | Client-side enforcement is bypassed by direct API calls; SQL is the gate |
| Feature flag library | None — `useSubscription()` hook + `<FeatureGate>` component using DB column | 3 tiers, 7 features; LaunchDarkly/Statsig is over-engineering |

---

## Critical Constraints

These cannot be skipped or deferred. Getting any of these wrong requires a production reconciliation script to fix.

1. **`subscription_tier` must only be writable by service-role.** If the RLS UPDATE policy on `trainer_profiles` allows the authenticated trainer to PATCH their own row, they can self-upgrade to Elite for free. This must be locked down in the migration, not as a follow-up.

2. **Billing webhook secret must be separate from Connect webhook secret.** The existing `STRIPE_WEBHOOK_SECRET` is for Connect events. Billing events verified with the wrong secret throw a signature mismatch and are silently dropped (function returns 400). Either: (a) create a second webhook endpoint in Stripe Dashboard for billing events with its own `whsec_*` stored as `STRIPE_BILLING_WEBHOOK_SECRET`, or (b) use one endpoint and route on `event.account` presence. Decision must be made before any billing event handler code is written.

3. **`trial_settings.end_behavior.missing_payment_method: 'cancel'` must be set on subscription creation.** Without this, trial-expired subscriptions with no card enter `past_due` and linger indefinitely. Stripe does not self-cancel. This parameter is set once at subscription creation time — it cannot be added retroactively to existing subscriptions.

4. **`invoice.payment_failed` must be handled in the webhook.** Even with `end_behavior: 'cancel'` set, payment failures during active subscriptions (not trials) must trigger a `subscription_tier` downgrade to `free` in the DB. This is separate from the trial-end path.

5. **Slot limits must be enforced in SQL, not just React.** The `get_visible_slots(p_trainer_id)` RPC must apply the `LIMIT` based on `subscription_tier`. Direct Supabase REST API calls bypass the React UI entirely. The RLS/RPC layer is the actual gate.

6. **`stripe_customer_id` must be created before the first subscription, not assumed to exist.** The `create-subscription` Edge Function must check whether the trainer already has a `stripe_customer_id` and create one if not. A trainer can reach subscription signup before completing Connect onboarding — these are independent paths.

---

## Open Decisions

Questions the team must resolve before implementation begins.

| Decision | Options | Recommendation | Impact |
|----------|---------|----------------|--------|
| Webhook routing: one endpoint or two? | (A) Two endpoints — Connect uses existing secret, Billing gets its own `STRIPE_BILLING_WEBHOOK_SECRET`. (B) One endpoint — route on `event.account` presence, use correct secret per event type. | Two endpoints (A) — operationally simpler; each secret is unambiguous; less conditional logic in the handler. | Determines how `stripe-webhook` is extended and what secrets are added to Supabase |
| Featured section ordering for multiple Elite trainers | (A) `rating DESC, review_count DESC, created_at ASC`. (B) Weighted score from analytics RPC. (C) Manual admin pin only. | Option A for v2.1; admin pin as override. | Must be defined before the landing page query is written; no ORDER BY is unacceptable |
| Trial abuse mitigation scope for v2.1 | (A) None — accept some abuse at launch scale. (B) Phone verification at trial start. (C) Stripe Radar customer risk score check. | At minimum, check Stripe Radar risk score at Customer creation (low effort). Phone verification is recommended but can ship in v2.1.x. | Affects `create-subscription` Edge Function logic and profile schema |
| Admin manual tier override persistence | (A) Override is superseded the moment a real subscription starts. (B) Override persists regardless of subscription state until explicitly removed. | Option A — subscription state from Stripe is authoritative; admin override is for trial/exceptional access only. | Affects webhook logic: must check `tier_overridden_by` before writing tier on subscription events |
| Pause subscription (reduce churn) | (A) Ship in v2.1. (B) Defer to v2.1.x after core tiers launch. | Defer to v2.1.x — adds Stripe pause collection complexity; not needed for launch. | Scope boundary for v2.1 |

---

## Phase Structure Recommendation

Build order is driven by hard dependencies. Each phase is independently testable before the next begins.

### Phase A: Foundation — DB + Stripe Config
**Rationale:** Everything depends on the schema and Stripe objects. These are pure configuration with no code risk.
**Delivers:** Migration-ready DB, Stripe Products/Prices created, secrets configured.
**Work:**
- Migration: extend `trainer_profiles` with 8 new columns (see ARCHITECTURE.md for exact DDL)
- Migration: create `subscription_events` table with `stripe_event_id UNIQUE` idempotency key
- Migration: add `get_visible_slots(p_trainer_id)` RPC enforcing 3/10/unlimited slot limits
- Migration: lock `subscription_tier` column — no UPDATE via authenticated user RLS
- Stripe Dashboard: create 2 Products (Pro, Elite) and 4 Price objects (monthly/annual for each)
- Stripe Dashboard: store Price IDs as Supabase secrets (`STRIPE_PRICE_PRO_MONTHLY`, etc.)
- Stripe Dashboard: create billing webhook endpoint; store secret as `STRIPE_BILLING_WEBHOOK_SECRET`
**Pitfalls to avoid:** P1 (acct_ vs cus_ confusion — add `stripe_customer_id` column here), P4 (client-side-only gates — add RLS lock here), P2 (webhook secret collision — create second endpoint here)

### Phase B: Core Billing Backend — Edge Functions + Webhook
**Rationale:** Backend must exist before frontend can be wired. Webhook handler must be correct before any subscription can be created (events fire immediately on creation).
**Delivers:** Two new Edge Functions + extended webhook; fully functional subscription lifecycle in the backend with no frontend.
**Work:**
- `create-subscription` Edge Function: JWT auth, Customer creation if needed, subscription with trial, write-back to DB
- Extend `stripe-webhook`: add 6 new `case` blocks for Billing events; idempotency INSERT-first pattern; send trial_will_end email via Resend
- `manage-subscription` Edge Function: `billing_portal` action (generates portal URL); `cancel`, `upgrade`, `downgrade` actions for direct API calls; invoice list
- Extend `get_admin_analytics` RPC: MRR + subscriber counts from `trainer_profiles`
**Pitfalls to avoid:** P2 (webhook secret), P3 (trial end no-card), P4 (invoice.payment_failed handler), P5 (idempotency)

### Phase C: Feature Gates + Search/Discovery
**Rationale:** Gates can be wired once the DB columns exist and the webhook is populating them correctly. Search and landing page placement are high-value differentiators that drive trainer upgrade conversion.
**Delivers:** Working feature gates; Pro trainers rank higher in search; Elite trainers appear in featured section.
**Work:**
- `useSubscription()` hook + `<FeatureGate tier="pro">` component
- Priority search placement: add `tier_rank` weight to `get_trainer_search` ORDER BY
- Gate advanced analytics tab by tier (already built; show/hide only)
- Featured trainers section on landing page: Elite-only query with deterministic ORDER BY
- Gate custom bio character limit (280 Free / 1000 Pro+) in Edge Function input validation
- Soft-hide excess slots on downgrade: "3 of N slots visible" message in trainer dashboard
**Pitfalls to avoid:** P4 (client-only gates — all gates have server enforcement), P6 (downgrade data integrity — clear Elite branding fields on tier drop), P7 (featured section must have ORDER BY)

### Phase D: Subscription UI + Trial Flow
**Rationale:** UI is the last layer; all backend mechanics must be proven before the UI is wired to them.
**Delivers:** Complete trainer-facing subscription experience: pricing page, trial CTA, manage subscription link, status indicator, trial expiry prompts.
**Work:**
- Pricing page: tier comparison table, monthly/annual toggle, "Start Free Trial" CTA
- Trial flow: `create-subscription` call, success state, trial banner with countdown
- "Manage Subscription" button: calls `manage-subscription` → redirects to Stripe Billing Portal
- Subscription status indicator in trainer dashboard (tier badge, next billing date, trial countdown)
- Downgrade confirmation modal: list exactly what features will be lost
- Annual billing toggle: "Save 20%" badge, monthly-equivalent display alongside annual price
**Pitfalls to avoid:** P3 (UX: trial warning emails are backend-driven, not just UI), UX pitfall of no proration preview before upgrade

### Phase E: Admin Visibility + Overrides
**Rationale:** Admin tooling is lower urgency than trainer-facing features but needed before launch to handle exceptions.
**Delivers:** Admin can see tier per trainer, manually override tier, and see MRR/subscriber metrics.
**Work:**
- Admin trainer table: add subscription tier badge and status column
- Admin manual tier override: write via service-role path; record `tier_overridden_by` + `tier_overridden_at`; override logic in webhook (subscription supersedes override)
- Admin MRR widget + subscriber count in existing analytics tab
- Admin: flag trainers approaching trial end with no payment method attached
**Pitfalls to avoid:** P8 (trial abuse monitoring)

### Phase F: Post-Launch Polish (v2.1.x)
**Rationale:** These features reduce churn and add polish but are not required for the billing system to be trustworthy at launch.
**Delivers:** Churn reduction features and UX improvements validated by real usage data.
**Work (defer from v2.1):**
- Custom branded URL / trainer slug (routing complexity: slug uniqueness, redirect on slug change, reserved slugs)
- Pause subscription (Stripe pause collection; feature gates revert to Free during pause)
- Upgrade prompt contextual modals ("You'd appear to 3x more clients on Pro")
- Invoice history via Stripe Customer Portal link
- Proration preview (`stripe.invoices.retrieveUpcoming()`) before upgrade confirmation

---

### Phase Ordering Rationale

- Phase A before everything: the DB schema is the contract all other phases build against. Schema changes after Phase B or C create migration risk on a production app with 14 existing migrations.
- Phase B before Phase D: frontend cannot be tested against a real subscription lifecycle until the backend is correct. The webhook must fire and update the DB correctly before any UI component reads `subscription_tier` and expects it to be accurate.
- Phase C alongside or after Phase B: feature gates read from the DB columns created in Phase A and populated in Phase B. Gates can be wired the moment Phase B is testable (gates just render correctly for `subscription_tier = 'trialing'`).
- Phase D last among core phases: user-facing UI is the final integration point. All edge cases (trial end, failed payment, downgrade) must be proven at the backend layer before the UI declares them handled.
- Phase E parallel-capable with Phase D: admin UI reads the same DB columns and can be built in parallel once Phase A + B are complete.

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase A:** Stripe Dashboard configuration and SQL migrations — direct Stripe docs; additive-only migrations.
- **Phase B:** All 6 webhook events, both Edge Functions, and idempotency pattern are fully specified in ARCHITECTURE.md and PITFALLS.md.
- **Phase D:** Subscription UI and Customer Portal redirect are low-complexity; no research needed.

Phases that may benefit from phase-specific research during planning:
- **Phase C (search ranking):** The existing `get_trainer_search` query's ORDER BY logic is not documented in the research files. Adding `tier_rank` weighting needs a look at the current query before designing the change.
- **Phase F (custom slug routing):** Reserved slug enumeration, slug-change redirect behavior, and iOS deep link implications are not covered in this research batch. Flag for research before v2.1.x planning.

---

## Risk Register

| Rank | Risk | Likelihood | Impact | Mitigation |
|------|------|-----------|--------|------------|
| 1 | Billing webhook events dropped due to wrong secret — subscriptions never update DB tier | HIGH if not explicitly set up | CRITICAL — trainers retain/lose features incorrectly | Create second Stripe webhook endpoint for billing events; store as `STRIPE_BILLING_WEBHOOK_SECRET`; verify in Phase A |
| 2 | Trial-expired trainers retain Pro/Elite features because `past_due` is not handled | HIGH if trial_settings not configured | HIGH — platform gives away paid features | Set `end_behavior.missing_payment_method: 'cancel'` at subscription creation; handle `invoice.payment_failed` in webhook |
| 3 | Trainer self-upgrades by PATCHing `subscription_tier` via REST API if RLS not locked | MEDIUM (requires deliberate exploit) | HIGH — free access to paid features | RLS UPDATE policy must restrict `subscription_tier` to service-role only; verify in Phase A migration |
| 4 | Elite branding fields (`custom_bio_url`) persist after downgrade — broken profile state | MEDIUM (any downgrade path) | MEDIUM — data integrity issue; support escalations | Postgres function triggered on tier change NULLs Elite-only fields; implemented in Phase C |
| 5 | Trial abuse via multiple OAuth accounts with email aliases | MEDIUM at launch scale | LOW-MEDIUM (revenue impact proportional to scale) | Stripe Radar risk score check at Customer creation in Phase B; phone verification in Phase F |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All Stripe SDK versions verified against npm registry; API version pinned; Connect v1 pattern confirmed in official docs |
| Features | HIGH (table stakes) / MEDIUM (competitive positioning) | Behavior specs (trial, slot gates, downgrade) are HIGH confidence from Stripe docs; competitor analysis is MEDIUM |
| Architecture | HIGH | Directly derived from official Stripe Billing + Connect documentation and existing codebase inspection |
| Pitfalls | HIGH | Primary sources are official Stripe docs; community sources corroborate but are not sole basis for any pitfall |

**Overall confidence:** HIGH

### Gaps to Address

- **Current `get_trainer_search` query shape:** Research does not include the existing search query. Before implementing Pro priority ranking (Phase C), read the current RPC to design the `tier_rank` weight addition correctly.
- **Existing `stripe-webhook` function structure:** Research references extending it but does not reproduce its current code. Before Phase B, read `stripe-webhook/index.ts` to understand the existing `switch(event.type)` block and the Supabase client instantiation pattern.
- **`profiles` vs `trainer_profiles` table name:** STACK.md uses `profiles`, ARCHITECTURE.md uses `trainer_profiles`. The actual production table name must be confirmed against the schema before writing the migration.
- **Trial abuse threshold:** No data yet on how much trial abuse FitRush will face at current scale. Monitor for 30 days post-launch; add phone verification if abuse rate exceeds 5% of trial starts.

---

## Sources

### Primary (HIGH confidence — official Stripe documentation)
- [Use trial periods on subscriptions](https://docs.stripe.com/billing/subscriptions/trials) — trial_period_days, payment_method_collection, trial_settings.end_behavior
- [Compare SaaS platform configs for Accounts v1 and v2](https://docs.stripe.com/connect/accounts-v2/saas-platform-payments-billing) — v1 separate Customer object pattern
- [Create subscriptions with Stripe Billing (Connect)](https://docs.stripe.com/connect/subscriptions) — separate Customer requirement for v1 accounts
- [Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) — event set and timing
- [Integrate the customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal) — portal session creation
- [Upgrade and downgrade subscriptions](https://docs.stripe.com/billing/subscriptions/upgrade-downgrade) — proration options
- [Connect webhooks](https://docs.stripe.com/connect/webhooks) — webhook secret separation between Connect and platform account
- [Customer abuse evaluation](https://docs.stripe.com/radar/customer-abuse) — trial abuse mitigation
- [Stripe Blog: First-party fraud trends (Nov 2025)](https://stripe.com/blog/analyzing-first-party-fraud-trends-account-free-trial-and-refund-abuse) — trial abuse prevalence

### Secondary (MEDIUM confidence — community / competitive)
- [Stigg: Upgrade & Downgrade Flows Guide](https://www.stigg.io/blog-posts/the-only-guide-youll-ever-need-to-implement-upgrade-downgrade-flows-part-2) — downgrade behavior patterns
- [Trainerize Pricing](https://www.trainerize.com/pricing/) — direct competitor slot/client limit model
- [Churnkey: Pause vs Cancel](https://churnkey.co/blog/how-to-encourage-saas-customers-to-pause-their-subscriptions-instead-of-cancelling/) — ~30% save rate on pause offer
- [Userpilot: Credit Card vs No Credit Card](https://userpilot.com/blog/credit-card-vs-no-credit-card/) — no-card trial conversion rate data

---

*Research completed: 2026-03-15*
*Ready for roadmap: yes*
