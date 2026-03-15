# Roadmap — FitRush v2.0 — Monetization Sprint

## Overview

3 phases. Payouts first (cash flow for trainers), then analytics (visibility), then referrals (growth).

Phase numbering continues from v1.0 (last phase = 8) → v2.0 starts at Phase 9.

---

## Phase 9: Trainer Payout System

**Goal:** Enable trainers to withdraw earnings via Stripe Connect.

**Requirements:** PAYOUT-01, PAYOUT-02, PAYOUT-03, PAYOUT-04, PAYOUT-05, PAYOUT-06

**Plans:** 3/3 plans complete

Plans:
- [ ] 09-01-PLAN.md — Payout backend: DB migration, create-payout Edge Function, Resend email integration
- [ ] 09-02-PLAN.md — Payouts tab UI: balance display, transaction history, Request Payout modal
- [ ] 09-03-PLAN.md — Weekly auto-payout (pg_cron) + payout.paid webhook completion email

**Success Criteria:**
- Trainer sees accurate available balance on payout dashboard (updates after each completed booking)
- Trainer can request on-demand payout and receives Stripe transfer within 2 business days
- Weekly auto-payout fires every Monday for trainers with balance >= $50
- Transaction history lists all transfers with date, amount, and status
- Trainer receives email on payout initiation and completion

**Depends on:** Existing Stripe Connect setup (trainer accounts created in v1.0)

---

## Phase 10: Earnings Analytics

**Goal:** Give trainers and admins full visibility into revenue, trends, and discount impact.

**Requirements:** ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05, ANALYTICS-06

**Plans:** 1/1 plans complete

Plans:
- [ ] 10-01-PLAN.md — Postgres analytics RPC migration + analytics.ts utility library
- [ ] 10-02-PLAN.md — Trainer AnalyticsTab component + TrainerDashboard tab extension
- [ ] 10-03-PLAN.md — Admin analytics tab with time filter and top earners table
- [ ] 10-04-PLAN.md — Final build verification + human verification checkpoint

**Success Criteria:**
- Trainer dashboard shows earnings by selected time range with revenue trend chart
- Trainer sees gross vs net earnings, booking count, avg price, and discount adoption %
- Admin sees platform-wide revenue, total payouts, booking volume, and top earners table
- Admin can filter analytics by time period (week/month/quarter/year)
- Trainer can download earnings as CSV with correct totals for the selected range

**Depends on:** Phase 9 (completed booking payment records needed for accurate aggregation)

---

## Phase 11: Referral Program v1

**Goal:** Drive viral user acquisition through tracked referral incentives.

**Requirements:** REFERRAL-01, REFERRAL-02, REFERRAL-03, REFERRAL-04, REFERRAL-05, REFERRAL-06

**Plans:** 4/4 plans complete

Plans:
- [ ] 11-01-PLAN.md — Referral DB migration (referrals table, referral_code, discount columns, leaderboard RPC) + referral.ts utility
- [ ] 11-02-PLAN.md — process-referral-reward Edge Function (idempotent reward processing, notifications, email)
- [ ] 11-03-PLAN.md — ReferralWidget component + Landing cookie capture + RoleSelect attribution + dashboard integrations
- [ ] 11-04-PLAN.md — BookSession $5 discount + TrainerBookings reward trigger + ReferralLeaderboard + human verification

**Success Criteria:**
- Every user has a visible referral code and shareable link on their profile
- New user signing up via referral link is correctly attributed to the referrer
- $10 trainer payout credit is applied after referred client's first completed booking
- $5 client discount is applied at checkout for referred trainer's first booking with that client
- Landing page leaderboard shows top 10 referrers updated monthly
- In-app + email notifications fire at key referral milestones

**Depends on:** Phase 9 (payout credit mechanism required for trainer $10 reward)

---

## Dependency Graph

```
Phase 9 (Payouts) → Phase 10 (Analytics)
Phase 9 (Payouts) → Phase 11 (Referrals)
```

Analytics and Referrals can run in parallel after Payouts ships.

---

## Deferred to v2.1

- **Phase 12: Subscription Tiers** — Pro ($9/mo) + Elite ($29/mo), Stripe Billing, feature gates

---
*3 phases, 18 requirements. Payouts unlock both analytics accuracy and referral credit mechanics.*
