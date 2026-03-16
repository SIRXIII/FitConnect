# Roadmap — FitRush

## Milestones

- ✅ **v1.0 Feature Complete** — Phases 1–8 (shipped ~2026-03-01)
- ✅ **v2.0 Monetization Sprint** — Phases 9–11 (shipped 2026-03-15)
- 📋 **v2.1 Subscription Tiers** — Phases 12–16 (planned)

---

## Phases

<details>
<summary>✅ v1.0 Feature Complete — shipped ~2026-03-01</summary>

- [x] Phase 5: Admin Dashboard — `/admin` with analytics, users, reviews, settings tabs
- [x] Phase 6: In-App Messaging — real-time chat via Supabase Realtime + unread badge
- [x] Phase 7: AI Scheduling MVP — idle slot classification + Best Deals Now section
- [x] Phase 8: Enhanced Reviews — sub-ratings (punctuality/expertise/communication), trainer responses, admin moderation

_Phases 1–4 deferred to v1.1 security patch._

See: `.planning/milestones/v2.0-ROADMAP.md` for full v2.0 details.

</details>

<details>
<summary>✅ v2.0 Monetization Sprint — shipped 2026-03-15</summary>

- [x] Phase 9: Trainer Payout System (3/3 plans) — Stripe transfers, $50 min on-demand, weekly pg_cron auto-payout, Resend emails
- [x] Phase 10: Earnings Analytics (4/4 plans) — trainer + admin dashboards, Postgres RPCs, CSV export, Recharts visualizations
- [x] Phase 11: Referral Program v1 (4/4 plans) — referral_code, cookie attribution, $10/$5 incentives, leaderboard, notifications

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

---

### 📋 v2.1 Subscription Tiers (Planned)

- [x] **Phase 12: Subscription Foundation** — DB schema migration + Stripe Dashboard config; prerequisite for all billing phases
- [x] **Phase 13: Billing Backend** — Full subscription lifecycle server-side: create-subscription, webhook handlers, manage-subscription, trial-end email (completed 2026-03-16)
- [ ] **Phase 14: Feature Gates + Search** — Tier gates enforced at DB level; Pro/Elite trainers get priority search placement and Featured section
- [ ] **Phase 15: Subscription UI** — Trainer-facing pricing page, trial activation flow, subscription status, Customer Portal link
- [ ] **Phase 16: Admin Subscription Visibility** — Admin tier badges, manual tier override, MRR + subscriber analytics

---

## Phase Details

### Phase 12: Subscription Foundation
**Goal**: DB schema and Stripe Dashboard configuration are in place so every subsequent phase builds on a stable, locked-down contract
**Depends on**: Phase 11 (existing production app)
**Requirements**: None directly — infrastructure foundation for BILL-01 through ADMN-03
**Success Criteria** (what must be TRUE):
  1. Running `\d trainer_profiles` in production shows all 10 new columns (`subscription_tier`, `subscription_status`, `stripe_customer_id`, `subscription_id`, `subscription_interval`, `trial_ends_at`, `current_period_end`, `cancel_at_period_end`, `tier_overridden_by`, `tier_overridden_at`) with correct types and defaults
  2. A service-role UPDATE to `subscription_tier` succeeds; an authenticated-role UPDATE to `subscription_tier` is rejected by the `guard_subscription_tier_write` BEFORE UPDATE trigger
  3. `SELECT get_visible_slots('<free_trainer_id>')` returns at most 3 rows; Pro returns at most 10; Elite returns all
  4. The `subscription_events` table exists with a `UNIQUE` constraint on `stripe_event_id`
  5. Stripe Dashboard shows 2 Products (Pro, Elite), 4 Price objects, a configured Customer Portal, and a billing webhook endpoint with its own `whsec_*` secret stored as `STRIPE_BILLING_WEBHOOK_SECRET` in Supabase
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md — DB migration: 10 subscription columns, subscription_events table, guard trigger, get_visible_slots RPC, TypeScript types
- [x] 12-02-PLAN.md — Stripe Dashboard config: 2 Products, 4 Prices, Customer Portal, dunning, billing webhook endpoint, 5 Supabase secrets

### Phase 13: Billing Backend
**Goal**: Full subscription lifecycle is handled server-side with no frontend dependency — subscriptions can be created, webhook events correctly sync tier to DB, trial-end email fires, and admin analytics include MRR
**Depends on**: Phase 12
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08
**Success Criteria** (what must be TRUE):
  1. Calling `create-subscription` with a valid trainer JWT creates a Stripe Customer (if none exists), creates a subscription with `trial_period_days: 30` and `payment_method_collection: 'if_required'`, and writes `subscription_status = 'trialing'` and `trial_ends_at` to `trainer_profiles`
  2. Simulating `customer.subscription.deleted` via Stripe CLI fires the webhook handler and sets `subscription_tier = 'free'` in the DB within the same request; a duplicate event with the same `stripe_event_id` is a no-op (idempotency)
  3. Simulating `invoice.payment_failed` via Stripe CLI sets `subscription_tier = 'free'` in the DB for an active (non-trial) subscription
  4. Simulating `customer.subscription.trial_will_end` (3 days out) triggers a Resend email to the trainer's address with a link to add a payment method
  5. Calling `manage-subscription` with a valid trainer JWT returns a valid Stripe Customer Portal URL
  6. `get_admin_analytics` RPC response includes `mrr`, `pro_subscriber_count`, and `elite_subscriber_count` fields
**Plans**: TBD

### Phase 14: Feature Gates + Search
**Goal**: Tier gates are enforced at the DB level and in the UI; Pro trainers rank higher in search; Elite trainers appear in the Featured section on the landing page
**Depends on**: Phase 13
**Requirements**: TIER-01, TIER-02, TIER-03, TIER-04, TIER-05, TIER-06, SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. A Free trainer with 5 slots sees exactly 3 slots in the client booking view (enforced by `get_visible_slots` RPC, not just UI); the trainer dashboard shows "3 of 5 slots visible — upgrade to show all"
  2. Submitting a bio longer than 280 characters via the Edge Function as a Free trainer returns a validation error; the same request succeeds for a Pro trainer up to 1000 characters
  3. The advanced analytics tab is not rendered for a Free trainer; it renders correctly for a Pro or Elite trainer — verified by toggling `subscription_tier` directly in the DB
  4. After a trainer downgrades from Pro to Free, their excess slots and full bio content remain in the DB unchanged; only visibility reverts
  5. The trainer search results list ranks Pro trainers above equivalent Free trainers (same rating, same review count); Elite trainers rank above Pro
  6. The landing page shows a "Featured Trainers" section containing only Elite trainers ordered by `rating DESC`; the section is absent entirely when no Elite trainers exist
**Plans**: 4 plans

Plans:
- [ ] 14-01-PLAN.md — Tier gate foundation: tierGates.ts, useTier/useCan hooks, vitest config, test scaffold (TIER-04, TIER-05)
- [ ] 14-02-PLAN.md — DB + slot enforcement: bio trigger migration, TrainerProfile.tsx RPC wire (TIER-01, TIER-02, TIER-03, TIER-06)
- [ ] 14-03-PLAN.md — UI gates: AnalyticsTab gate + slot visibility hint in TrainerDashboard (TIER-05, TIER-06)
- [ ] 14-04-PLAN.md — Search: rankTrainers tier signal + FeaturedTrainers component + Landing.tsx (SRCH-01, SRCH-02, SRCH-03)

### Phase 15: Subscription UI
**Goal**: Trainers can discover, start, and manage their subscription entirely within the app without contacting support
**Depends on**: Phase 13, Phase 14
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05 (UI surface for backend capabilities delivered in Phase 13)
**Success Criteria** (what must be TRUE):
  1. A trainer navigating to the pricing page sees a tier comparison table with a monthly/annual toggle; switching to annual shows "Save 20%" and the per-month equivalent price for each tier
  2. Clicking "Start Free Trial" on the Pro tier calls `create-subscription`, shows a success state, and the trainer dashboard immediately displays tier badge "Pro — Trialing" with the trial end date
  3. A trainer whose trial ends in 6 days sees a persistent banner: "X days left in your Pro trial — add payment to keep access"; the banner is absent when more than 7 days remain
  4. Clicking "Manage Subscription" calls `manage-subscription` and redirects the trainer to the Stripe Customer Portal where they can upgrade, downgrade, cancel, or update payment details
  5. Clicking "Downgrade" within the app presents a confirmation modal listing the exact features that will be lost before the action is submitted
**Plans**: TBD

### Phase 16: Admin Subscription Visibility
**Goal**: Admin has full visibility into trainer subscription state and can intervene manually without requiring a Stripe action
**Depends on**: Phase 13
**Requirements**: ADMN-01, ADMN-02, ADMN-03
**Success Criteria** (what must be TRUE):
  1. The admin trainer list displays a tier badge (Free / Pro / Elite / Trialing / Past Due) next to each trainer, sourced live from `trainer_profiles.subscription_tier` and `subscription_status`
  2. An admin can set a manual tier override for any trainer; the trainer immediately gains that tier's features; a subsequent `customer.subscription.updated` webhook event from Stripe supersedes the override and sets the correct Stripe-driven tier
  3. The admin analytics tab displays MRR, Pro subscriber count, Elite subscriber count, and active trial count — all sourced from the updated `get_admin_analytics` RPC
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 5. Admin Dashboard | v1.0 | complete | ✅ | ~2026-03-01 |
| 6. In-App Messaging | v1.0 | complete | ✅ | ~2026-03-01 |
| 7. AI Scheduling MVP | v1.0 | complete | ✅ | ~2026-03-01 |
| 8. Enhanced Reviews | v1.0 | complete | ✅ | ~2026-03-01 |
| 9. Trainer Payout System | v2.0 | 3/3 | ✅ | 2026-03-14 |
| 10. Earnings Analytics | v2.0 | 4/4 | ✅ | 2026-03-15 |
| 11. Referral Program v1 | v2.0 | 4/4 | ✅ | 2026-03-15 |
| 12. Subscription Foundation | v2.1 | Complete    | 2026-03-16 | 2026-03-16 |
| 13. Billing Backend | 3/3 | Complete    | 2026-03-16 | — |
| 14. Feature Gates + Search | v2.1 | 0/4 | 📋 planned | — |
| 15. Subscription UI | v2.1 | 0/? | 📋 planned | — |
| 16. Admin Subscription Visibility | v2.1 | 0/? | 📋 planned | — |

---
*Last updated: 2026-03-16 after Phase 14 planned*
