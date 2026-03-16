# Requirements: FitRush v2.1 — Subscription Tiers

**Defined:** 2026-03-15
**Core Value:** Trainers monetize idle hours at optimized rates — subscription tiers unlock the tools and visibility that turn idle hours into booked sessions faster.

## v2.1 Requirements

### Billing

- [ ] **BILL-01**: Trainer can start a 30-day free trial of Pro or Elite tier with no credit card required
- [x] **BILL-02**: When trial ends with no payment method on file, subscription cancels automatically and trainer reverts to Free tier
- [ ] **BILL-03**: Trainer can upgrade from Free or trial to a paid tier by entering payment details
- [ ] **BILL-04**: Trainer can choose monthly or annual billing (annual = 20% discount, ~$7.20/mo Pro, ~$23.20/mo Elite)
- [ ] **BILL-05**: Trainer can upgrade, downgrade, cancel, or update payment method via Stripe Customer Portal (no custom UI required)
- [x] **BILL-06**: Stripe subscription events (created, updated, trial end, payment failure, cancellation) correctly sync `subscription_tier` to the database via webhook
- [x] **BILL-07**: Failed payment on an active (non-trial) subscription triggers automatic downgrade to Free tier in the database
- [x] **BILL-08**: Trainer receives an email 3 days before trial ends prompting them to add a payment method

### Tiers

- [ ] **TIER-01**: Free trainer: maximum 3 availability slots are visible to clients in search and booking
- [ ] **TIER-02**: Pro trainer ($9/mo): maximum 10 availability slots are visible to clients
- [ ] **TIER-03**: Elite trainer ($29/mo): all availability slots are visible to clients (no limit)
- [ ] **TIER-04**: Pro and Elite trainers can write an extended custom bio (up to 1000 characters; Free tier is limited to 280)
- [ ] **TIER-05**: Advanced earnings analytics dashboard (time-range charts, heatmap, CSV export) is gated to Pro and Elite trainers only
- [ ] **TIER-06**: When a trainer downgrades, their data (slots, bio content) is preserved; only visibility and access revert to the new tier's limits

### Search & Discovery

- [ ] **SRCH-01**: Pro trainers receive a priority search ranking boost over equivalent Free trainers in trainer search results
- [ ] **SRCH-02**: Elite trainers appear in a dedicated "Featured Trainers" section on the landing page, displayed above the standard trainer list
- [ ] **SRCH-03**: The Featured Trainers section is hidden entirely when no Elite trainers exist (no placeholder or fallback to Pro)

### Admin

- [ ] **ADMN-01**: Admin user list displays subscription tier (Free / Pro / Elite / trial) and status per trainer
- [ ] **ADMN-02**: Admin can manually grant or revoke a tier override for any trainer without requiring a Stripe subscription
- [ ] **ADMN-03**: Admin analytics tab displays MRR and active subscriber count broken down by tier (Pro and Elite)

---

## v2.1.x Requirements (Deferred)

Features that reduce churn or add polish but are not needed for the billing system to be trustworthy at launch. Schedule after v2.1 ships and real usage data is available.

### Churn Reduction

- **CHURN-01**: Trainer can pause their subscription (rather than cancel) — subscription enters Stripe pause collection; access reverts to Free during pause
- **CHURN-02**: Contextual upgrade modals displayed when a Free trainer hits a tier gate ("You'd appear in 3× more searches on Pro")

### Elite Branding

- **BRAND-01**: Elite trainer can set a custom profile URL/slug (e.g., `fitrush.com/trainers/john-smith`) — requires slug uniqueness enforcement, redirect on slug change, reserved slug list

### UX Polish

- **UX-01**: Trainer sees proration preview (`stripe.invoices.retrieveUpcoming()`) before confirming a mid-cycle upgrade
- **UX-02**: Invoice history viewable in-app (currently handled via Stripe Customer Portal redirect — in-app view would embed the portal or mirror invoice data)

### Security

- **SEC-01**: Phone verification required at trial start to deter multi-account trial abuse (beyond Stripe Radar risk score check)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Client-facing subscription tiers | Trainers are the revenue-generating subscribers; client subscriptions are a separate product concept not in the v2.1 vision |
| AI-powered slot pricing per tier | Requires demand data from 3–6 months of bookings; defer to v3.x |
| Video/virtual session tier | Platform is in-person first; video is explicitly out of scope for the current roadmap |
| Stripe Entitlements API | Adds async race conditions and latency; DB column + webhook is correct at 3-tier scale |
| Custom proration policies | Stripe default proration (immediate credit on upgrade, `cancel_at_period_end` on downgrade) is correct and FTC-compliant; custom behavior is over-engineering |
| Referral perks per tier | Referral program ships with flat incentives (v2.0); tier-gated referral bonuses add complexity without clear conversion data |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BILL-01 | Phase 13 | Pending |
| BILL-02 | Phase 13 | Complete |
| BILL-03 | Phase 13 | Pending |
| BILL-04 | Phase 13 | Pending |
| BILL-05 | Phase 13 | Pending |
| BILL-06 | Phase 13 | Complete |
| BILL-07 | Phase 13 | Complete |
| BILL-08 | Phase 13 | Complete |
| TIER-01 | Phase 14 | Pending |
| TIER-02 | Phase 14 | Pending |
| TIER-03 | Phase 14 | Pending |
| TIER-04 | Phase 14 | Pending |
| TIER-05 | Phase 14 | Pending |
| TIER-06 | Phase 14 | Pending |
| SRCH-01 | Phase 14 | Pending |
| SRCH-02 | Phase 14 | Pending |
| SRCH-03 | Phase 14 | Pending |
| ADMN-01 | Phase 16 | Pending |
| ADMN-02 | Phase 16 | Pending |
| ADMN-03 | Phase 16 | Pending |

**Coverage:**
- v2.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after research synthesis*
