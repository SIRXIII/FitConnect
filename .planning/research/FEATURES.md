# Feature Research

**Domain:** Trainer-facing subscription tiers on a luxury fitness marketplace (SaaS B2B2C)
**Researched:** 2026-03-15
**Confidence:** HIGH (Stripe docs + verified SaaS patterns) / MEDIUM (competitive comparisons)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features trainers assume exist once a subscription tier is introduced. Missing these makes the tier feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clear tier comparison page | Users need to see what they're buying before committing | LOW | Pricing table with feature checklist; annual/monthly toggle |
| Monthly + annual billing toggle | Industry standard; annual = 20% discount is the sweet spot | LOW | Stripe `price` objects per interval; toggle updates displayed price |
| 30-day free trial, no card required | Removes sign-up friction; "no card" outperforms card-required for marketplace B2B | LOW | Stripe `trial_period_days` on subscription; no `payment_method` needed during trial |
| In-app subscription status indicator | Trainers expect to see current tier + next billing date at a glance | LOW | Read from Stripe customer portal or cached DB column |
| Self-serve upgrade path | Trainers must be able to upgrade without contacting support | MEDIUM | Stripe Checkout or Payment Element; proration handled automatically |
| Self-serve cancel/downgrade path | FTC Click-to-Cancel rule (2025) mandates cancellation is as easy as signup | MEDIUM | Must not require email or support ticket; in-app flow required |
| Invoice history | Trainers need receipts for tax purposes | LOW | Stripe Customer Portal covers this out of the box |
| Slot gate enforcement at display layer | Free-tier trainers must never show more than 3 slots to clients | MEDIUM | Query-level enforcement in trainer search RPC; not just UI hide |
| Trial expiry email sequence | Users forget trial ends; 3-day and 1-day warning emails are expected | MEDIUM | Edge Function + Resend; Stripe `customer.subscription.trial_will_end` webhook |
| Grace period on failed payment | Involuntary churn via card decline is common; brief retry window is industry norm | MEDIUM | Stripe `dunning` settings; Stripe retries 3-4x by default over ~7 days |

### Differentiators (Competitive Advantage)

Features that justify the upgrade cost and are specific to FitRush's positioning as a luxury marketplace.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Priority search placement (Pro) | Directly converts to more bookings; tangible ROI | MEDIUM | Add `tier_rank` column to profiles; weight into existing search query ORDER BY |
| Advanced analytics tab (Pro) | Trainers can optimize their idle-hour strategy with trend data | LOW | Already built; gate visibility by tier in frontend check + DB policy |
| Featured section on landing page (Elite) | Maximum client acquisition surface; exclusive and visible | MEDIUM | Curated section above trainer grid; query Elite trainers only; rotate or static |
| Custom bio (Pro/Elite) | Differentiation vs free generic bio; luxury brand signal | LOW | Character limit increase or rich text; simple schema change |
| Custom branded URL (Elite) | `/trainer/jane-doe` vs `/trainer/uuid`; professionalism signal | MEDIUM | Requires slug field on profiles + routing logic; slug uniqueness constraint |
| Priority support (Elite) | Perceived value for $29/mo even if rarely used | LOW | Separate support email/tag; no infrastructure change; SLA commitment only |
| Pause subscription (all paid tiers) | Reduces cancellations by ~30%; pause 1-3 months beats losing trainer entirely | MEDIUM | Stripe pause collection; feature gates revert to Free during pause |
| Upgrade prompt with booking-impact message | Show "You'd appear to 3x more clients on Pro" at slot limit hit | LOW | Upsell modal triggered on gated action; contextual copy beats generic |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Hard slot deletion on downgrade | "Enforce the limit cleanly" | Destroys trainer data; causes support escalations and rage churn | Soft-hide excess slots from client view; flag in dashboard "3 of 8 slots visible — upgrade to show all" |
| Immediate feature removal on cancel | "Stop giving access once cancelled" | Trainers have paid through the billing period; removing access mid-cycle is a trust violation | Schedule removal for billing period end; show countdown in UI |
| Card-required free trial | Higher-intent signups | Significantly reduces trial starts; marketplace trainers are acquisition-sensitive | No-card trial; collect card at trial-end conversion prompt |
| Per-booking percentage fee on top of tier | "Extra monetization lever" | Stacks with existing 8% platform fee; trainers will feel double-taxed; erodes trust | Keep flat tier pricing; platform fee stays 8% regardless of tier |
| Automatic upgrade when slot limit hit | "Frictionless revenue" | Dark pattern; causes chargebacks and support issues; potentially illegal in some jurisdictions | Gate action, show upgrade modal, require explicit confirmation |
| Annual-only pricing for Elite | "Lock in high-value users" | Limits adoption; $29/mo already high for early-stage marketplace | Offer both; annual discount incentivizes without mandating |
| Public tier badge on trainer card | "Social proof for Elite trainers" | Reveals business model to clients who don't care; may feel pay-to-win | Keep tier signals internal to trainer dashboard only |

---

## Feature Dependencies

```
[Stripe Billing integration]
    └──required by──> [Subscription create/upgrade/downgrade UI]
    └──required by──> [Trial with no card]
    └──required by──> [Invoice history]
    └──required by──> [Grace period dunning]
    └──required by──> [Annual billing toggle]

[trainer_subscriptions DB table (tier + status + Stripe IDs)]
    └──required by──> [Slot gate enforcement]
    └──required by──> [Priority search placement]
    └──required by──> [Advanced analytics gate]
    └──required by──> [Featured section query]
    └──required by──> [Admin tier status view]
    └──required by──> [Manual tier override]

[Stripe webhook handler (subscription events)]
    └──required by──> [Trial expiry emails]
    └──required by──> [Tier sync on upgrade/downgrade]
    └──required by──> [Grace period enforcement]
    └──required by──> [MRR calculation]

[Slot gate enforcement]
    └──enhances──> [Upgrade prompt with booking-impact message]

[Custom branded URL (slug)]
    └──requires──> [Profile slug field + uniqueness constraint]
    └──requires──> [Router change for /trainer/:slug]

[Advanced analytics tab]
    └──already built──> [gate visibility only; no new analytics work needed]

[Priority search placement]
    └──depends on──> [Discount-based weighted ranking (deferred in PROJECT.md)]
    └──note──> [Tier rank is independent weight; can ship without discount weighting]

[Featured section on landing page]
    └──conflicts with──> [Referral leaderboard layout] (both compete for landing page real estate)
    └──resolve──> [Featured trainers section above leaderboard; distinct visual treatment]
```

### Dependency Notes

- **Stripe Billing is the foundational dependency.** Everything else — gating, trials, invoices, admin MRR — flows from subscription state managed in Stripe.
- **trainer_subscriptions table is the enforcement source of truth.** Client-facing queries must read from this table, not from a frontend prop, to prevent gate bypass.
- **Custom branded URL has routing implications.** Must handle slug collisions, slug changes (redirect old URL), and reserved slugs (admin, login, etc.).
- **Advanced analytics is already built.** This is a gating task only — show/hide the tab based on tier. No new analytics development needed.
- **Featured section conflicts with landing page layout.** The referral leaderboard is already placed on the landing page. Featured trainers section needs deliberate placement to avoid visual competition.

---

## MVP Definition

This is a subsequent milestone (v2.1), not a greenfield product. "MVP" here means the minimum to make the tier system real and trustworthy.

### Launch With (v2.1 core)

- [ ] Stripe Billing integration — subscriptions, webhooks, plan sync to DB
- [ ] trainer_subscriptions table — tier, status, stripe_subscription_id, trial_end, billing_interval
- [ ] Slot gate enforcement — query-level, not UI-only; Free = 3, Pro = 10, Elite = unlimited
- [ ] Subscription management UI — pricing page, upgrade flow, cancel/downgrade flow
- [ ] Trial start flow — no card required; 30 days; converts on card entry at trial end
- [ ] Trial expiry emails — 3-day warning + 1-day warning via existing Resend integration
- [ ] Priority search placement (Pro) — tier_rank weight in trainer search ORDER BY
- [ ] Advanced analytics gate — hide analytics tab for Free tier (already built; just gate it)
- [ ] Featured trainers section (Elite) — landing page section querying Elite trainers
- [ ] Annual billing toggle — 20% discount; Stripe yearly price objects
- [ ] Admin: tier status per trainer — visible in existing user management table
- [ ] Admin: MRR + subscriber count — new metrics in existing admin analytics tab

### Add After Validation (v2.1.x)

- [ ] Custom branded URL (slug) — routing complexity warrants its own slice after core ships
- [ ] Pause subscription — reduces churn; lower priority than initial tier launch
- [ ] Upgrade prompt contextual modals — polish layer; add after gating is stable
- [ ] Invoice history via Stripe Customer Portal — low effort, add when trainers request it

### Future Consideration (v2.2+)

- [ ] Per-tier slot notification preferences — Fine-grained control; wait for trainer feedback
- [ ] Tier-based client messaging limits — Would require message infrastructure changes
- [ ] White-label coach page (beyond custom URL) — Significant design/infra investment

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Stripe Billing + DB table | HIGH | MEDIUM | P1 |
| Slot gate enforcement (query level) | HIGH | MEDIUM | P1 |
| Subscription management UI | HIGH | MEDIUM | P1 |
| Trial flow (no card) | HIGH | LOW | P1 |
| Trial expiry emails | HIGH | LOW | P1 |
| Priority search placement | HIGH | LOW | P1 |
| Advanced analytics gate | HIGH | LOW | P1 |
| Annual billing toggle | MEDIUM | LOW | P1 |
| Admin tier status + MRR | MEDIUM | LOW | P1 |
| Featured trainers section | HIGH | MEDIUM | P1 |
| Custom branded URL | MEDIUM | MEDIUM | P2 |
| Pause subscription | MEDIUM | MEDIUM | P2 |
| Upgrade prompt modals | MEDIUM | LOW | P2 |
| Stripe Customer Portal (invoices) | LOW | LOW | P2 |

---

## Behavior Specifications

### Trial Expiry Behavior

1. Trainer signs up → Stripe subscription created with `trial_period_days: 30`, no `default_payment_method`
2. At day 27 → `customer.subscription.trial_will_end` webhook fires → send 3-day warning email
3. At day 29 → send 1-day warning email
4. At day 30 (trial end) with no card → subscription status becomes `past_due` or `canceled` depending on Stripe config
   - **Recommended:** Use `trial_settings.end_behavior.missing_payment_method: cancel` so subscription cancels cleanly rather than entering dunning
5. After trial ends without converting → trainer reverts to Free tier immediately; no grace period on intentional non-conversion
6. If trainer adds card before trial ends → subscription activates on trial end; pro-rated charge for first partial month applies

### Slot Gate Enforcement Behavior

- Slot count is enforced at **query time in the trainer search RPC**, not at UI render time
- Free tier: `LIMIT 3` on visible slots ordered by `created_at ASC` (oldest = most reliable signals)
- Pro tier: `LIMIT 10`
- Elite tier: no limit
- On downgrade from Pro to Free: excess slots (slots 4–10) remain in DB but are hidden from client-facing queries
  - Trainer dashboard shows: "3 of 8 slots visible — upgrade to show all"
  - No slots are deleted
- On upgrade from Free to Pro: hidden slots become visible immediately (no re-creation needed)
- **New slot creation** is also gated: Free trainer cannot create a 4th slot; show upgrade prompt

### Upgrade Behavior

- Upgrades take effect immediately
- Proration applied: trainer charged only for remaining days at new tier price
- Stripe `proration_behavior: create_prorations` (default) — proration line item on next invoice
- Feature access granted immediately on Stripe webhook `customer.subscription.updated` with new tier
- Do not wait for next billing cycle to grant access

### Downgrade Behavior

- Downgrades are **scheduled to the end of current billing period** (Zoom/GitHub model)
- Trainer retains current tier features until billing period ends
- UI shows: "Your [tier] access ends on [date]. After that, you'll move to [lower tier]."
- On billing period end: webhook fires → update DB tier → enforce new gates
- Excess slots become hidden (not deleted) on downgrade effective date
- Custom URL/slug: retained in DB but no longer resolves if trainer downgrades from Elite (redirect to standard URL); reactivates on re-upgrade

### Cancellation Behavior

- Cancel schedules for end of billing period (never immediate mid-cycle removal)
- Cancellation flow must include: reason survey (optional), pause offer, downgrade-to-Free offer
- After cancel effective date: trainer reverts to Free tier automatically; no account deletion
- Failed payment / involuntary churn: Stripe retries 4x over 7 days (configure in Stripe dashboard); after exhaustion → cancel and revert to Free; send notification email
- Stripe `cancel_at_period_end: true` is the correct API behavior for end-of-period cancel

### Featured Placement Behavior

- Elite trainers are queried for the featured section on the landing page
- If > N Elite trainers exist, rotate daily (deterministic: `ORDER BY trainer_id, date_trunc('day', now())` hash) to ensure fairness
- If 0 Elite trainers exist, section is hidden (do not show empty section or fall back to Pro trainers — that dilutes the Elite value proposition)
- Admin can manually pin specific Elite trainers to featured (override rotation)

### Annual Billing Behavior

- Annual plan = 12 months prepaid at 20% discount (~$7.20/mo Pro, ~$23.20/mo Elite)
- Stripe: separate `price` objects for monthly and annual intervals on each product
- Downgrade from annual to monthly: takes effect at annual period end; trainer gets full annual period at lower price
- Upgrade from monthly to annual: proration calculated; trainer charged difference for remainder of year
- No refund on annual plans — clearly stated at checkout

### Admin Manual Override Behavior

- Admin can grant any tier (Free/Pro/Elite) to any trainer, bypassing billing
- Override stored as `manual_override: true` + `override_tier: 'pro'` on trainer record
- Manual override does not create or modify Stripe subscription
- Override persists until admin removes it or trainer subscribes normally (subscription supersedes override)
- Admin overrides are audited (who granted, when, reason)

---

## Competitor Feature Analysis

| Feature | Trainerize | Fyt | FitRush Approach |
|---------|------------|-----|-----------------|
| Subscription tiers for trainers | Yes (Free/Pro/Studio) — client count limits | No trainer tiers (platform fee model) | Slot visibility + search placement; aligns with idle-hour model |
| Free tier | 1 active client (very restrictive) | N/A | 3 slots visible; usable but clearly limited |
| Slot/client hard limit enforcement | Excess clients auto-deactivated | N/A | Soft-hide (preserve data); show upgrade prompt |
| Featured placement | No | No | Elite-exclusive; high perceived value |
| Custom URL/branding | Yes (paid tiers) | No | Elite only; slug-based routing |
| Annual discount | ~16% | N/A | 20% (slightly above industry median to drive annual commits) |
| No-card trial | No (card required) | N/A | Yes; reduces friction for trainer acquisition |

---

## Sources

- [Stripe Prorations Documentation](https://docs.stripe.com/billing/subscriptions/prorations) — HIGH confidence; authoritative on proration behavior
- [Stripe Modify Subscriptions](https://docs.stripe.com/billing/subscriptions/change) — HIGH confidence; upgrade/downgrade API behaviors
- [Stigg: Upgrade & Downgrade Flows Guide](https://www.stigg.io/blog-posts/the-only-guide-youll-ever-need-to-implement-upgrade-downgrade-flows-part-2) — MEDIUM confidence; verified against Stripe docs
- [SaaStr: Pause is Better Than Cancel](https://www.saastr.com/as-a-saas-company-do-you-allow-customers-to-pause-their-account/) — MEDIUM confidence; industry consensus
- [Chargebee: Trial Strategy Guide](https://www.chargebee.com/resources/guides/subscription-pricing-trial-strategy/saas-trial-plans/) — MEDIUM confidence; trial conversion benchmarks
- [InnerTrends: Annual Discount Analysis (100 SaaS companies)](https://www.innertrends.com/blog/saas-pricing-strategies) — MEDIUM confidence; 20% is at the high end of sweet spot
- [Userpilot: Credit Card vs No Credit Card](https://userpilot.com/blog/credit-card-vs-no-credit-card/) — MEDIUM confidence; conversion rate data
- [Churnkey: Pause vs Cancel](https://churnkey.co/blog/how-to-encourage-saas-customers-to-pause-their-subscriptions-instead-of-cancelling/) — MEDIUM confidence; ~30% save rate on pause offer
- [Trainerize Pricing](https://www.trainerize.com/pricing/) — MEDIUM confidence; direct competitor; slot/client limit patterns
- [Rigby: Subscription Marketplace Features 2026](https://www.rigbyjs.com/blog/subscription-marketplace-features) — MEDIUM confidence; marketplace-specific patterns

---

*Feature research for: FitRush v2.1 — Trainer Subscription Tiers*
*Researched: 2026-03-15*
