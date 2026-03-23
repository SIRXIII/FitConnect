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

## v5.0 — App Store Ready

**Goal:** Polish every user flow (client, trainer, admin), ensure mobile responsiveness, fix all UX issues, and ship a build ready for Apple App Store submission.

### Phase 29: Mobile Responsive Polish
**Goal**: Every page renders correctly on mobile (375-414px), trainer/client dashboards work on small screens, map view is mobile-optimized
**Depends on**: v4.0
**Requirements**: RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, RESP-07, RESP-08
**Success Criteria**:
  1. Landing page, login, search, and trainer profiles render correctly at 375px
  2. Trainer dashboard tabs are accessible on mobile (scroll or collapse)
  3. Client dashboard and booking wizard work without horizontal overflow
  4. Map view uses full screen on mobile with overlay filters
**Plans:** TBD

### Phase 30: Auth & Onboarding Hardening
**Goal**: Auth flows work end-to-end — sign up, sign in, forgot password, role selection, onboarding completion — with no dead ends or raw errors
**Depends on**: Phase 29
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria**:
  1. Email sign-up sends confirmation, user returns and is authenticated
  2. Forgot password sends email, user resets password and can log in
  3. New user sees role selection and completes onboarding for their role
  4. All auth errors show friendly messages, never raw JSON
  5. Protected routes redirect to login with return URL preserved
**Plans:** TBD

### Phase 31: Trainer Flow End-to-End Verification
**Goal**: A trainer can sign up, complete onboarding, set availability, go live, receive a booking, log a session, view earnings, and manage their subscription — every step works
**Depends on**: Phase 30
**Requirements**: TRAINER-01, TRAINER-02, TRAINER-03, TRAINER-04, TRAINER-05, TRAINER-06, TRAINER-07, TRAINER-08
**Success Criteria**:
  1. Trainer onboarding creates a complete profile
  2. Availability slots can be created, edited, and deleted
  3. Go Live toggle works and shows trainer on map
  4. Trainer dashboard shows tagline, bookings, earnings, analytics
  5. Session logging works after a completed booking
**Plans:** TBD

### Phase 32: Client Flow End-to-End Verification
**Goal**: A client can sign up, set fitness passport, search trainers, book a session, pay, view bookings, cancel, leave a review, and configure notification preferences — every step works
**Depends on**: Phase 30
**Requirements**: CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04, CLIENT-05, CLIENT-06, CLIENT-07, CLIENT-08
**Success Criteria**:
  1. Client onboarding creates a complete fitness passport
  2. Trainer search with filters returns results
  3. Booking wizard completes with payment
  4. Client can cancel and leave reviews
  5. Notification preferences save and persist
**Plans:** TBD

### Phase 33: Admin Dashboard Live Data & Controls
**Goal**: Wire admin dashboard to real Supabase data — live analytics (revenue, bookings, users from DB), transaction list with payment status, payout approval/reject/hold per trainer, full user management with active/inactive filtering. Remove all demo/hardcoded data.
**Depends on**: Phase 31, Phase 32
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06
**Success Criteria**:
  1. Analytics tab shows real revenue, booking counts, active users, and platform fees from Supabase
  2. Transactions tab lists all payments with client, trainer, amount, status, date
  3. Payouts tab lets admin approve/reject/hold individual trainer payouts
  4. Users tab shows all users with role, status (active/suspended), last login, filterable
  5. No demo/mock data anywhere in admin dashboard
  6. Cert approval button works without freezing
**Plans:** TBD

### Phase 34: Capacitor iOS Build
**Goal**: FitRush compiles and runs as an iOS app via Capacitor, with proper splash screen, status bar, safe areas, and native keyboard handling
**Depends on**: Phase 33
**Requirements**: MOBILE-01, MOBILE-02, MOBILE-03, MOBILE-04, MOBILE-05
**Success Criteria**:
  1. `npx cap sync ios` succeeds
  2. App launches in iOS Simulator without crashes
  3. Safe area insets respected (notch, home indicator)
  4. Status bar and splash screen show FitRush branding
  5. Keyboard doesn't obscure inputs
**Plans:** TBD

---

## v6.0 — Growth Engine

**Goal:** Features that drive trainer acquisition and client bookings in a local market. Real mobile push notifications, trainer video intros for trust-building, and group sessions to expand booking capacity and reduce per-client cost.

### Phase 35: Push Notifications
**Goal**: Trainers get instant push notifications when someone books, cancels, or messages. Clients get booking confirmations and trainer-live alerts on their phone.
**Depends on**: Phase 34
**Requirements**: PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05
**Success Criteria**:
  1. Trainer receives a push notification on their phone when a client books a session
  2. Client receives push when their booking is confirmed or a nearby trainer goes live
  3. Push notifications work on both web (FCM) and iOS (APNs via Capacitor)
  4. User can enable/disable push from settings
**Plans:** 2 plans
Plans:
- [ ] 35-01-PLAN.md — FCM infrastructure: push_subscriptions table, service worker, send-push-notification edge function, client subscription utility
- [ ] 35-02-PLAN.md — Wire triggers: booking/cancel edge functions call push, permission prompt on dashboard, settings toggle

### Phase 36: Trainer Video Intros
**Goal**: Trainers can upload a 30-second intro video to their profile. Clients see it on the trainer card and profile page.
**Depends on**: Phase 34
**Requirements**: VIDEO-01, VIDEO-02, VIDEO-03, VIDEO-04, VIDEO-05
**Success Criteria**:
  1. Trainer can upload a video from their dashboard
  2. Video appears on their public profile page with play button
  3. Trainer cards show a "Video" badge if the trainer has an intro
  4. Videos are compressed client-side before upload
**Plans:** 2 plans
Plans:
- [ ] 36-01-PLAN.md — Upload path: schema migration, videoUtils (duration check + thumbnail capture), VideoUploader component in trainer dashboard
- [ ] 36-02-PLAN.md — Client display: inline video player on trainer profile, Video badge on trainer cards

### Phase 37: Group Sessions
**Goal**: Trainers can create group session slots with max capacity. Multiple clients book the same slot at a lower per-person rate. Clients see remaining spots.
**Depends on**: Phase 34
**Requirements**: GROUP-01, GROUP-02, GROUP-03, GROUP-04, GROUP-05, GROUP-06
**Success Criteria**:
  1. Trainer can create a group slot with capacity and per-person rate
  2. Client sees "3/5 spots left" and books at the group rate
  3. Multiple clients can book the same slot
  4. Trainer dashboard shows all participants for group sessions
**Plans:** 2/2 plans complete
Plans:
- [ ] 37-01-PLAN.md — Schema + trainer creation UI: slot_type/max_capacity/group_rate migration, group slot form fields, RPCs
- [ ] 37-02-PLAN.md — Booking flow + client display: capacity enforcement, spots-remaining badge, participant list in trainer dashboard, group-safe cancellation

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
| 35. Push Notifications | v6.0 | 0/2 | planned | — |
| 36. Trainer Video Intros | v6.0 | 0/2 | planned | — |
| 37. Group Sessions | 2/2 | Complete   | 2026-03-21 | — |

---
*Last updated: 2026-03-20 -- v6.0 Growth Engine planned*
