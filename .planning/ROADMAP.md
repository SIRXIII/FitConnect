# Roadmap — FitRush

## Milestones

- ✅ **v1.0 Feature Complete** — Phases 1–8 (shipped ~2026-03-01)
- ✅ **v2.0 Monetization Sprint** — Phases 9–11 (shipped 2026-03-15)
- ✅ **v2.1 Subscription Tiers** — Phases 12–16 (shipped 2026-03-17)

---

## Phases

<details>
<summary>✅ v1.0 Feature Complete — shipped ~2026-03-01</summary>

- [x] Phase 5: Admin Dashboard — `/admin` with analytics, users, reviews, settings tabs
- [x] Phase 6: In-App Messaging — real-time chat via Supabase Realtime + unread badge
- [x] Phase 7: AI Scheduling MVP — idle slot classification + Best Deals Now section
- [x] Phase 8: Enhanced Reviews — sub-ratings (punctuality/expertise/communication), trainer responses, admin moderation

_Phases 1–4 deferred to v1.1 security patch._

</details>

<details>
<summary>✅ v2.0 Monetization Sprint — shipped 2026-03-15</summary>

- [x] Phase 9: Trainer Payout System (3/3 plans) — Stripe transfers, $50 min on-demand, weekly pg_cron auto-payout, Resend emails
- [x] Phase 10: Earnings Analytics (4/4 plans) — trainer + admin dashboards, Postgres RPCs, CSV export, Recharts visualizations
- [x] Phase 11: Referral Program v1 (4/4 plans) — referral_code, cookie attribution, $10/$5 incentives, leaderboard, notifications

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Subscription Tiers — shipped 2026-03-17</summary>

- [x] Phase 12: Subscription Foundation (2/2 plans) — DB schema migration (10 columns), write-guard trigger, get_visible_slots RPC, Stripe Dashboard config
- [x] Phase 13: Billing Backend (3/3 plans) — create-subscription, stripe-billing-webhook, manage-subscription, trial-end email, admin MRR RPC
- [x] Phase 14: Feature Gates + Search (4/4 plans) — tierGates.ts, useTier/useCan hooks, bio trigger, slot visibility, analytics gating, tier ranking, FeaturedTrainers
- [x] Phase 15: Subscription UI (3/3 plans) — Pricing page, trial activation, trial banner, subscription management tab, downgrade modal
- [x] Phase 16: Admin Subscription Visibility (3/3 plans) — Tier badges, manual tier override, MRR + subscriber analytics cards

See: `.planning/milestones/v2.1-ROADMAP.md`

</details>

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
| 12. Subscription Foundation | v2.1 | 2/2 | ✅ | 2026-03-16 |
| 13. Billing Backend | v2.1 | 3/3 | ✅ | 2026-03-16 |
| 14. Feature Gates + Search | v2.1 | 4/4 | ✅ | 2026-03-16 |
| 15. Subscription UI | v2.1 | 3/3 | ✅ | 2026-03-17 |
| 16. Admin Subscription Visibility | v2.1 | 3/3 | ✅ | 2026-03-17 |

---
*Last updated: 2026-03-17 after v2.1 milestone shipped*
