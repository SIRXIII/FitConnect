# Roadmap -- FitRush

## Milestones

- v1.0 Feature Complete -- Phases 1-8 (shipped ~2026-03-01)
- v2.0 Monetization Sprint -- Phases 9-11 (shipped 2026-03-15)
- v2.1 Subscription Tiers -- Phases 12-16 (shipped 2026-03-17)
- v3.0 The Premium Experience & Trust Update -- Phases 17-20 (shipped 2026-03-18)
- v4.0 The Live Platform -- Phases 21-28 (shipped 2026-03-19)

---

## Phases

<details>
<summary>v1.0 Feature Complete -- shipped ~2026-03-01</summary>

- [x] Phase 5: Admin Dashboard -- `/admin` with analytics, users, reviews, settings tabs
- [x] Phase 6: In-App Messaging -- real-time chat via Supabase Realtime + unread badge
- [x] Phase 7: AI Scheduling MVP -- idle slot classification + Best Deals Now section
- [x] Phase 8: Enhanced Reviews -- sub-ratings (punctuality/expertise/communication), trainer responses, admin moderation

_Phases 1-4 deferred to v1.1 security patch._

</details>

<details>
<summary>v2.0 Monetization Sprint -- shipped 2026-03-15</summary>

- [x] Phase 9: Trainer Payout System (3/3 plans) -- Stripe transfers, $50 min on-demand, weekly pg_cron auto-payout, Resend emails
- [x] Phase 10: Earnings Analytics (4/4 plans) -- trainer + admin dashboards, Postgres RPCs, CSV export, Recharts visualizations
- [x] Phase 11: Referral Program v1 (4/4 plans) -- referral_code, cookie attribution, $10/$5 incentives, leaderboard, notifications

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Subscription Tiers -- shipped 2026-03-17</summary>

- [x] Phase 12: Subscription Foundation (2/2 plans) -- DB schema migration (10 columns), write-guard trigger, get_visible_slots RPC, Stripe Dashboard config
- [x] Phase 13: Billing Backend (3/3 plans) -- create-subscription, stripe-billing-webhook, manage-subscription, trial-end email, admin MRR RPC
- [x] Phase 14: Feature Gates + Search (4/4 plans) -- tierGates.ts, useTier/useCan hooks, bio trigger, slot visibility, analytics gating, tier ranking, FeaturedTrainers
- [x] Phase 15: Subscription UI (3/3 plans) -- Pricing page, trial activation, trial banner, subscription management tab, downgrade modal
- [x] Phase 16: Admin Subscription Visibility (3/3 plans) -- Tier badges, manual tier override, MRR + subscriber analytics cards

See: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>v3.0 The Premium Experience & Trust Update -- shipped 2026-03-18</summary>

- [x] Phase 16.1: QA Hotfix -- 404 page, route guards, mobile hero contrast, footer links, console error silencing
- [x] Phase 17: Security Hardening (3/3 plans) -- RLS audit (40+ policies), Zod validation (3->9 schemas), audit log + triggers + admin viewer
- [x] Phase 18: Trainee Fitness Passport (3/3 plans) -- Client avatar upload + compression, bio field, Fitness Passport intake, trainer-visible summary
- [x] Phase 19: Calendar Export & Buffer Times (3/3 plans) -- iCal .ics export, live feed URL, buffer time config + enforcement
- [x] Phase 20: UX Polish (3/3 plans) -- Skeleton loading, ErrorState + mapError, image optimization, booking wizard redesign

See: `.planning/milestones/v3.0-ROADMAP.md`

</details>

## v4.0 -- The Live Platform (Complete) -> [Archive](milestones/v4.0-ROADMAP.md)

9 phases, 24 plans, 44 requirements. Waitlist, live availability, Google Maps, client profiles, session logging, AI matching, discount analytics, location notifications, Google Calendar sync. Shipped 2026-03-19.

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 5. Admin Dashboard | v1.0 | complete | done | ~2026-03-01 |
| 6. In-App Messaging | v1.0 | complete | done | ~2026-03-01 |
| 7. AI Scheduling MVP | v1.0 | complete | done | ~2026-03-01 |
| 8. Enhanced Reviews | v1.0 | complete | done | ~2026-03-01 |
| 9. Trainer Payout System | v2.0 | 3/3 | done | 2026-03-14 |
| 10. Earnings Analytics | v2.0 | 4/4 | done | 2026-03-15 |
| 11. Referral Program v1 | v2.0 | 4/4 | done | 2026-03-15 |
| 12. Subscription Foundation | v2.1 | 2/2 | done | 2026-03-16 |
| 13. Billing Backend | v2.1 | 3/3 | done | 2026-03-16 |
| 14. Feature Gates + Search | v2.1 | 4/4 | done | 2026-03-16 |
| 15. Subscription UI | v2.1 | 3/3 | done | 2026-03-17 |
| 16. Admin Subscription Visibility | v2.1 | 3/3 | done | 2026-03-17 |
| 16.1 QA Hotfix | v3.0 | 1/1 | done | 2026-03-17 |
| 17. Security Hardening | v3.0 | 3/3 | done | 2026-03-17 |
| 18. Trainee Fitness Passport | v3.0 | 3/3 | done | 2026-03-18 |
| 19. Calendar Export & Buffer Times | v3.0 | 3/3 | done | 2026-03-18 |
| 20. UX Polish | v3.0 | 3/3 | done | 2026-03-18 |
| 21. Email Capture + Platform Controls | v4.0 | 2/2 | done | 2026-03-18 |
| 22. Availability Toggle Foundation | v4.0 | 3/3 | done | 2026-03-19 |
| 23. Map View + Trainer Locations | v4.0 | 4/4 | done | 2026-03-19 |
| 23.1. Client Profile Enhancement | v4.0 | 3/3 | done | 2026-03-19 |
| 24. Session Logging | v4.0 | 3/3 | done | 2026-03-19 |
| 25. AI Trainer-Client Matching | v4.0 | 2/2 | done | 2026-03-19 |
| 26. AI Discount Analytics | v4.0 | 2/2 | done | 2026-03-19 |
| 27. Location-Based Notifications | v4.0 | 2/2 | done | 2026-03-19 |
| 28. Google Calendar Bidirectional Sync | v4.0 | 3/3 | done | 2026-03-19 |

---
*Last updated: 2026-03-20 -- v4.0 archived*
