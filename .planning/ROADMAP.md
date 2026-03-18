# Roadmap — FitRush

## Milestones

- ✅ **v1.0 Feature Complete** — Phases 1–8 (shipped ~2026-03-01)
- ✅ **v2.0 Monetization Sprint** — Phases 9–11 (shipped 2026-03-15)
- ✅ **v2.1 Subscription Tiers** — Phases 12–16 (shipped 2026-03-17)
- 🔨 **v3.0 The Premium Experience & Trust Update** — Phases 17–20

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

### Hotfix: Phase 16.1 — QA Fixes

- [x] Phase 16.1: QA Hotfix — 404 page, route guards, mobile hero contrast, footer links, console error silencing

### v3.0 The Premium Experience & Trust Update

- [x] **Phase 17: Security Hardening** — SEC-01→SEC-07: JWT verification (pre-existing ✅), SQL injection (pre-existing ✅), RLS audit (40+ policies verified ✅), payment race condition (webhook-driven ✅), cancellation refunds (pre-existing ✅), Zod validation (expanded 3→9 schemas), audit log table + triggers + admin viewer
- [x] **Phase 18: Trainee Fitness Passport** — FIT-01→FIT-06: Client avatar upload + compression, bio field, Fitness Passport intake form (goals, workout types, frequency, limitations), trainer-visible summary on booking detail (completed 2026-03-18)
  **Plans:** 3 plans
  Plans:
  - [ ] 18-01-PLAN.md — DB migration: add bio + training_frequency to client_profiles
  - [ ] 18-02-PLAN.md — Client Fitness Passport page (avatar upload, bio, intake form)
  - [ ] 18-03-PLAN.md — Trainer-visible passport summary on booking detail
- [ ] **Phase 19: Calendar Export & Buffer Times** — CAL-01→CAL-06: iCal .ics export, live iCal feed URL with opaque token, buffer time configuration (15/30/45/60 min), server-side buffer enforcement, get_visible_slots buffer integration
  **Plans:** 3 plans
  Plans:
  - [ ] 19-01-PLAN.md — DB migration: calendar_export_token + buffer_minutes columns, reset RPC, Zod schema
  - [ ] 19-02-PLAN.md — calendar-export Edge Function + buffer enforcement in trigger and RPC
  - [ ] 19-03-PLAN.md — Calendar tab UI on TrainerDashboard (export card + buffer selector)

### Phase 19: Calendar Export & Buffer Times

**Goal:** Enable trainers to export their schedules to external calendars and configure buffer times between sessions.

**Requirements:** CAL-01→CAL-06
- CAL-01: iCal .ics file export (one-time download of current bookings)
- CAL-02: Live iCal feed URL with opaque token (subscribe from Google Calendar / Apple Calendar)
- CAL-03: Buffer time configuration UI (15/30/45/60 min between sessions)
- CAL-04: Server-side buffer time enforcement (reject bookings that violate buffer)
- CAL-05: get_visible_slots buffer integration (hide slots within buffer window)
- CAL-06: Calendar settings page for trainers

- [ ] **Phase 20: UX Polish** — UXP-01→UXP-04: Booking flow redesign with progress indicator, image optimization + compression, skeleton loading screens, actionable error states

**Build order rationale:** Security first (primitives consumed by all later phases) → Profiles (frontend-heavy, table exists) → Calendar (new Edge Function + DB columns) → UX Polish (cross-cutting refinements last).

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
| 16.1 QA Hotfix | hotfix | 1/1 | ✅ | 2026-03-17 |
| 17. Security Hardening | v3.0 | 3/3 | ✅ | 2026-03-17 |
| 18. Trainee Fitness Passport | v3.0 | 3/3 | ✅ | 2026-03-18 |
| 19. Calendar Export & Buffer Times | 2/3 | In Progress|  | — |
| 20. UX Polish | v3.0 | — | ⬜ | — |

---
*Last updated: 2026-03-18 — Phase 19 planned (3 plans)*
