# Requirements — FitRush v2.0

**Defined:** 2026-03-14
**Core Value:** Trainers monetize idle hours; clients get premium training at below-market prices

---

## v2.0 Requirements

### Payouts

- [ ] **PAYOUT-01**: Trainer sees available balance + pending balance on payout dashboard
- [x] **PAYOUT-02**: Trainer can initiate on-demand payout when balance ≥ $50
- [ ] **PAYOUT-03**: Platform auto-initiates weekly payout every Monday for trainers with balance ≥ $50
- [x] **PAYOUT-04**: Balance calculated as: completed bookings sum − 8% platform fee − Stripe fees (~2.9% + $0.30)
- [ ] **PAYOUT-05**: Transaction history shows date, amount, status (pending/completed/failed) per transfer
- [x] **PAYOUT-06**: Trainer receives email when payout is initiated and when it completes

### Analytics

- [ ] **ANALYTICS-01**: Trainer sees earnings dashboard with week/month/quarter/year range selector
- [ ] **ANALYTICS-02**: Trainer sees key metrics: gross earnings, net earnings, bookings count, avg price, discount adoption %
- [ ] **ANALYTICS-03**: Trainer sees charts: revenue trend line, booking count trend, peak hours heatmap
- [ ] **ANALYTICS-04**: Admin sees aggregate metrics: total platform revenue, total trainer payouts, booking volume
- [ ] **ANALYTICS-05**: Admin can segment analytics by trainer (top earners list) and by time period
- [ ] **ANALYTICS-06**: Trainer can export earnings history as CSV (for tax purposes)

### Referrals

- [ ] **REFERRAL-01**: Each user has a unique referral code visible on profile with a shareable link
- [ ] **REFERRAL-02**: Trainer refers client → client books → trainer earns $10 payout credit
- [ ] **REFERRAL-03**: Client refers trainer → trainer books that client → client gets $5 discount on next booking
- [ ] **REFERRAL-04**: Referral attribution: link sets cookie → links new user to referrer on signup → credit applied on first booking completion
- [ ] **REFERRAL-05**: Top 10 referrers leaderboard displayed on landing page, refreshes monthly
- [ ] **REFERRAL-06**: Referral notifications: "You referred [User] — earn reward when they book" (in-app + email)

---

## v2.1 Requirements (Deferred)

### Subscription Tiers

- **PREMIUM-01**: Trainer can subscribe to Pro tier ($9/month) for priority search placement and advanced analytics
- **PREMIUM-02**: Trainer can subscribe to Elite tier ($29/month) for custom branding and featured section
- **PREMIUM-03**: Stripe Billing integration: automatic recurring charges, upgrade/downgrade UI, invoice history
- **PREMIUM-04**: Feature gates: free (3 slots visible), Pro (10 slots, custom bio), Elite (unlimited, branded)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| External calendar sync | High API complexity, v1.1+ |
| ML-based pricing / recommendations | Needs 6-12 months booking data |
| Video sessions / virtual training | Focus on in-person marketplace |
| Multi-language / i18n | US market first |
| Mobile native apps | Web-first, Capacitor wrapping sufficient |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAYOUT-01 | Phase 9 | Pending |
| PAYOUT-02 | Phase 9 | Complete |
| PAYOUT-03 | Phase 9 | Pending |
| PAYOUT-04 | Phase 9 | Complete |
| PAYOUT-05 | Phase 9 | Pending |
| PAYOUT-06 | Phase 9 | Complete |
| ANALYTICS-01 | Phase 10 | Pending |
| ANALYTICS-02 | Phase 10 | Pending |
| ANALYTICS-03 | Phase 10 | Pending |
| ANALYTICS-04 | Phase 10 | Pending |
| ANALYTICS-05 | Phase 10 | Pending |
| ANALYTICS-06 | Phase 10 | Pending |
| REFERRAL-01 | Phase 11 | Pending |
| REFERRAL-02 | Phase 11 | Pending |
| REFERRAL-03 | Phase 11 | Pending |
| REFERRAL-04 | Phase 11 | Pending |
| REFERRAL-05 | Phase 11 | Pending |
| REFERRAL-06 | Phase 11 | Pending |

**Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after v2.0 milestone initialization*
