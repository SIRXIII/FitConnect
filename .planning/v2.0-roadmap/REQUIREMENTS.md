# v2.0 Requirements — Monetization Sprint

## Strategic Goal

Transform FitConnect from a **booking platform** into a **revenue-generating marketplace**.

**Success Definition:**
- Trainers see measurable earnings and withdraw regularly
- Admins have visibility into revenue streams and trends
- Growth compounds via viral referral mechanics
- Platform retention improves due to earning incentives

---

## Phase 1: Trainer Payout System

**Goal:** Enable trainers to withdraw earnings via Stripe Connect

### Requirements

**REQ-PAYOUT-01: Payout Dashboard**
- Trainers see available balance (sum of completed bookings - 8% platform fee)
- Display pending balance (completed within last 30 days, not yet paid out)
- Show transaction history (date, amount, status: pending/completed/failed)
- One-click payout initiation (triggers Stripe Connect transfer)

**REQ-PAYOUT-02: Payout Workflow**
- Stripe Connect account creation required (already exists in Phase 3 setup)
- Payout frequency: weekly (auto on Mondays) or on-demand (user-initiated)
- Minimum payout threshold: $25 USD
- Payout status: pending → completed (within 2 business days)

**REQ-PAYOUT-03: Balance Calculation**
- Accurate gross revenue: sum of booking prices across completed sessions
- Deductions: platform fee (8%), Stripe fees (~2.9% + $0.30)
- Net payout: gross - deductions
- Real-time balance updates after each booking completion

**REQ-PAYOUT-04: Notifications**
- Email when payout initiated
- Email when payout completed + receipt
- In-app notification badge for new balance available

---

## Phase 2: Earnings Analytics

**Goal:** Give trainers & admins visibility into revenue, trends, and discount impact

### Requirements

**REQ-ANALYTICS-01: Trainer Analytics Dashboard**
- Time range picker: week/month/quarter/year
- Key metrics display:
  - Total earnings (gross revenue this period)
  - Net earnings (after fees)
  - Bookings completed
  - Avg price per booking
  - Discount adoption (% of bookings with discount applied)
- Charts:
  - Revenue trend line (by week/day)
  - Booking count trend
  - Peak hours heatmap (which times most booked)
  - Discount impact (original vs discounted revenue)

**REQ-ANALYTICS-02: Admin Analytics Dashboard**
- Aggregate metrics (all trainers):
  - Total platform revenue
  - Total trainer payouts
  - Avg trainer earnings
  - Booking volume
  - Discount adoption rate
- Segmentation:
  - By trainer (top earners, growth)
  - By time period (YoY, MoM trends)
  - By location (regional performance)

**REQ-ANALYTICS-03: Data Export**
- CSV export of trainer earnings (for tax purposes)
- PDF reports (monthly/quarterly summaries)
- Admin can export full transaction log

**REQ-ANALYTICS-04: Insights**
- Recommendation: "Increase discount to 15% — trainers at 20% see 25% more bookings"
- Alert: "Low activity this week — promote idle hours with 10% discount"
- Trend: "Best booking times: 6-8 AM weekdays (54% of bookings)"

---

## Phase 3: Referral Program v1

**Goal:** Grow user base via viral mechanic (trainer & client referrals)

### Requirements

**REQ-REFERRAL-01: Referral Code Generation**
- Each trainer gets unique referral code (e.g., `SARAH_TRAINER_5K3Z`)
- Each client gets unique code at signup (e.g., `CLIENT_J2K8X`)
- Code visible on profile + shareable link

**REQ-REFERRAL-02: Referral Incentive**
- **Trainer referral:** Refer a client → client books → trainer gets $10 credit toward payout
- **Client referral:** Refer trainer → trainer books client → client gets $5 discount on next booking
- Both tracked via `referrals` table (referrer_id, referred_user_id, status: pending/completed)

**REQ-REFERRAL-03: Attribution & Tracking**
- Click referral link → set `referral_code` cookie
- On signup, link user to referrer
- On first booking, credit referrer (pending until booking completed)
- On completion, mark referral as completed + apply incentive

**REQ-REFERRAL-04: Referral Leaderboard**
- Top 10 trainers by # referrals this month
- Top 10 clients by # referrals this month
- Display on landing page (seasonal top 3)
- Optional badge on profile ("Top Referrer 🏆")

**REQ-REFERRAL-05: Notifications**
- "You referred [User]! Earn $10 when they book."
- "Your referral [User] booked! You earned $10 credit."
- "[User] referred you! Get $5 off your next booking."

---

## Phase 4: Subscription Tiers (Optional)

**Goal:** Premium features for trainers (custom branding, priority placement)

### Requirements (Deferred — post v2.0)

**REQ-PREMIUM-01: Tier Structure**
- Free: Current feature set
- Pro ($9/month): Custom profile URL, priority search placement, advanced analytics
- Elite ($29/month): Custom branding, priority support, featured section

**REQ-PREMIUM-02: Billing & Management**
- Stripe Billing integration (automatic recurring charges)
- Upgrade/downgrade UI in trainer dashboard
- Invoice history + receipts

**REQ-PREMIUM-03: Feature Gates**
- Free trainers: 3 available slots visible max
- Pro: 10 slots, custom bio formatting
- Elite: Unlimited slots, branded section

---

## Success Criteria for v2.0

| Metric | Target |
|--------|--------|
| Trainer monthly payout volume | $100K+ |
| Avg trainer balance | $200 |
| Payout frequency | 70%+ trainers monthly |
| Referral conversion | 10%+ new signups from referrals |
| Discount adoption | 20%+ of bookings at discount |
| User retention (30-day) | 50%+ (up from current baseline) |
| Admin visibility | <1 sec to see revenue dashboard |

---

## Technical Approach

- **Payout System:** Leverage existing Stripe Connect setup (Phase 3 if completed); add payout endpoint + webhook
- **Analytics:** Chart.js or Recharts (already in project); aggregate via Supabase views
- **Referrals:** New `referrals` table + RLS policies; attribution via cookie on signup
- **Premium:** Stripe Billing; feature gates via `is_premium` column in `trainer_profiles`

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Stripe Connect payout rate limits | Batch payouts weekly; queue system if needed |
| Referral fraud (fake signups) | Require identity verification before credit; referrer limits |
| Data accuracy (analytics mismatches) | Real-time aggregation views + hourly reconciliation |
| Admin dashboard slow on large datasets | Indexed queries; pre-computed summaries by day |

---

## Open Questions for Design Phase

1. **Payout frequency:** Weekly auto? On-demand only? Mix?
2. **Referral incentive amount:** $10 too much? Too little?
3. **Minimum payout threshold:** $25? $50? $100?
4. **Analytics export:** CSV only? PDF? Scheduling?
5. **Referral leaderboard:** Permanent or seasonal?
6. **Premium tier priority:** Month 2 or later?

---

*Next step:* Detailed design phase (Phase 1–4 implementation plans)
