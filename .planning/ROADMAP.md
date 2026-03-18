# Roadmap — FitRush

## Milestones

- ✅ **v1.0 Feature Complete** — Phases 1–8 (shipped ~2026-03-01)
- ✅ **v2.0 Monetization Sprint** — Phases 9–11 (shipped 2026-03-15)
- ✅ **v2.1 Subscription Tiers** — Phases 12–16 (shipped 2026-03-17)
- ✅ **v3.0 The Premium Experience & Trust Update** — Phases 17–20 (shipped 2026-03-18)
- 🚧 **v4.0 The Live Platform** — Phases 21–28 (in progress)

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

<details>
<summary>✅ v3.0 The Premium Experience & Trust Update — shipped 2026-03-18</summary>

- [x] Phase 16.1: QA Hotfix — 404 page, route guards, mobile hero contrast, footer links, console error silencing
- [x] Phase 17: Security Hardening (3/3 plans) — RLS audit (40+ policies), Zod validation (3→9 schemas), audit log + triggers + admin viewer
- [x] Phase 18: Trainee Fitness Passport (3/3 plans) — Client avatar upload + compression, bio field, Fitness Passport intake, trainer-visible summary
- [x] Phase 19: Calendar Export & Buffer Times (3/3 plans) — iCal .ics export, live feed URL, buffer time config + enforcement
- [x] Phase 20: UX Polish (3/3 plans) — Skeleton loading, ErrorState + mapError, image optimization, booking wizard redesign

See: `.planning/milestones/v3.0-ROADMAP.md`

</details>

### 🚧 v4.0 The Live Platform (In Progress)

**Milestone Goal:** Transform FitRush from a booking marketplace into an Uber-like real-time fitness platform with live location, AI-powered matching and analytics, and instant availability.

- [ ] **Phase 21: Email Capture + Platform Controls** — Landing page waitlist with position display, GCP billing safeguards, Google OAuth verification started
- [ ] **Phase 22: Availability Toggle Foundation** — Uber-style live toggle, sleep timer, atomic booking RPC
- [ ] **Phase 23: Map View + Trainer Locations** — Clustered trainer pins on Google Maps, trainer location management, live pin updates
- [ ] **Phase 24: Session Logging** — Post-session notes, structured workout logs, client progress timeline
- [ ] **Phase 25: AI Trainer-Client Matching** — Deterministic Fitness Passport scoring, "Recommended for You" section, match explanations
- [ ] **Phase 26: AI Discount Analytics** — Idle slot heatmap, discount recommendation cards, optimization score
- [ ] **Phase 27: Location-Based Notifications** — Nearby trainer alerts, notification preferences, frequency caps
- [ ] **Phase 28: Google Calendar Bidirectional Sync** — OAuth connect flow, booking push to GCal, external event blocking

## Phase Details

### Phase 21: Email Capture + Platform Controls
**Goal**: Visitors can join the waitlist and see their position, while Google Maps billing guardrails and OAuth verification are in place before any map code ships
**Depends on**: Nothing (first v4.0 phase)
**Requirements**: WAITLIST-01, WAITLIST-02, WAITLIST-03
**Success Criteria** (what must be TRUE):
  1. Visitor can enter email on the landing page and submit the waitlist form
  2. Visitor receives a Resend confirmation email within seconds of signup
  3. Visitor sees their position number ("You're #342") immediately after submitting
  4. GCP billing budget alert is set at $10/month and Maps API key is restricted to HTTP referrers
  5. Google OAuth consent screen is submitted for verification to start the 4–8 week approval clock
**Plans**: TBD

### Phase 22: Availability Toggle Foundation
**Goal**: Trainers can go online and offline with a live toggle and sleep timer, and the booking system handles concurrent requests without double-booking
**Depends on**: Phase 21
**Requirements**: AVAIL-01, AVAIL-02, AVAIL-03, AVAIL-04
**Success Criteria** (what must be TRUE):
  1. Trainer can flip online/offline with a single toggle tap from the trainer dashboard
  2. Trainer can set a sleep timer (1hr, 2hr, 4hr, end of day) that auto-disables availability
  3. A trainer who forgets to go offline has their availability automatically cleared by the system within 5 minutes of the timer expiry
  4. Two clients booking the same slot simultaneously results in exactly one successful booking and one clean error, with no double-booking
**Plans**: TBD

### Phase 23: Map View + Trainer Locations
**Goal**: Clients can discover available trainers on a live map with clustered pins, and trainers can manage their workout locations with address entry and map preview
**Depends on**: Phase 22
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, LOC-01, LOC-02, LOC-03, LOC-04
**Success Criteria** (what must be TRUE):
  1. Client can view a Google Map showing currently-available trainers as clustered pins
  2. Client can click a pin to see trainer name, specialty, rate, location type icon, and a Book button
  3. Client can toggle between the map view and the existing list view without losing their search filters
  4. Elite trainer pins display a tier badge; pins reflect location type (gym, park, in-home) via icon
  5. Trainer can add a workout location with address entry, drag-to-adjust pin, location type selection, and manage multiple locations
**Plans**: TBD

### Phase 24: Session Logging
**Goal**: Trainers can write post-session notes and structured workout data after a session, and clients can view their personal training history and progress over time
**Depends on**: Phase 22
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04
**Success Criteria** (what must be TRUE):
  1. Trainer can write and save post-session notes on a completed booking from their dashboard
  2. Client can read session notes left by their trainer on each past booking
  3. Trainer can log structured workout data (exercises, sets, reps) for a completed session
  4. Client sees a progress timeline view that charts session history and workout trends over time
**Plans**: TBD

### Phase 25: AI Trainer-Client Matching
**Goal**: Clients with a completed Fitness Passport see personalized trainer recommendations with visible match scores and explanations, and clients with incomplete passports are prompted to fill them in
**Depends on**: Phase 22
**Requirements**: AIMATCH-01, AIMATCH-02, AIMATCH-03, AIMATCH-04
**Success Criteria** (what must be TRUE):
  1. Client sees a "Recommended for You" section on the search page surfacing trainers matched to their Fitness Passport
  2. Each recommended trainer card shows a match score and 2–3 attribute explanations (e.g., "matches your HIIT goals, prefers your frequency")
  3. Client whose Fitness Passport is below the completeness threshold sees a prompt to complete it before recommendations appear
  4. Match results load quickly because they are cached for 24 hours after initial computation
**Plans**: TBD

### Phase 26: AI Discount Analytics
**Goal**: Trainers can see which time slots go unfilled as a heatmap, receive actionable discount recommendation cards for idle slots, and track their overall slot utilization score
**Depends on**: Phase 22
**Requirements**: AIANALYTICS-01, AIANALYTICS-02, AIANALYTICS-03
**Success Criteria** (what must be TRUE):
  1. Trainer sees an "Optimization" tab in their analytics dashboard with a day/hour heatmap showing idle slot patterns
  2. Trainer sees recommendation cards for specific empty time blocks (e.g., "5 idle Tuesday 9am slots — try 20–30% off")
  3. Trainer sees a numeric optimization score that reflects how well their available slots are being utilized
**Plans**: TBD

### Phase 27: Location-Based Notifications
**Goal**: Clients can opt into location-based alerts and receive in-app notifications when a nearby trainer goes live, with frequency caps and preferences configured before any alerts fire
**Depends on**: Phase 23 (PostGIS infrastructure), Phase 22 (availability toggle)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. Client can set a preferred area and configure notification preferences before any alerts are sent
  2. Client can enable live GPS mode via a "looking now" toggle to use their current location instead of saved area
  3. Client receives an in-app alert when a nearby trainer goes online within their configured area
  4. Client can turn location-based notifications on or off from their notification settings at any time
  5. A single trainer going online does not trigger more than one alert to the same client within 4 hours, and no client receives more than 3 location alerts per day
**Plans**: TBD

### Phase 28: Google Calendar Bidirectional Sync
**Goal**: Trainers can connect their Google Calendar and have FitRush bookings automatically appear as events, with external calendar blocks preventing double-booking, and iCal export remaining functional throughout
**Depends on**: Phase 27 (final phase; Google OAuth verification started in Phase 21)
**Requirements**: CALSYNC-01, CALSYNC-02, CALSYNC-03, CALSYNC-04, CALSYNC-05
**Success Criteria** (what must be TRUE):
  1. Trainer can connect Google Calendar via an OAuth flow from Settings without leaving the app
  2. A new FitRush booking automatically appears as an event in the trainer's connected Google Calendar
  3. An event added to the trainer's external Google Calendar blocks the corresponding FitRush availability slot from being booked
  4. When a booking is cancelled in FitRush, the corresponding Google Calendar event is removed
  5. Trainers who have not connected Google Calendar can still subscribe to the iCal feed as before
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
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
| 16.1 QA Hotfix | v3.0 | 1/1 | ✅ | 2026-03-17 |
| 17. Security Hardening | v3.0 | 3/3 | ✅ | 2026-03-17 |
| 18. Trainee Fitness Passport | v3.0 | 3/3 | ✅ | 2026-03-18 |
| 19. Calendar Export & Buffer Times | v3.0 | 3/3 | ✅ | 2026-03-18 |
| 20. UX Polish | v3.0 | 3/3 | ✅ | 2026-03-18 |
| 21. Email Capture + Platform Controls | v4.0 | 0/TBD | Not started | - |
| 22. Availability Toggle Foundation | v4.0 | 0/TBD | Not started | - |
| 23. Map View + Trainer Locations | v4.0 | 0/TBD | Not started | - |
| 24. Session Logging | v4.0 | 0/TBD | Not started | - |
| 25. AI Trainer-Client Matching | v4.0 | 0/TBD | Not started | - |
| 26. AI Discount Analytics | v4.0 | 0/TBD | Not started | - |
| 27. Location-Based Notifications | v4.0 | 0/TBD | Not started | - |
| 28. Google Calendar Bidirectional Sync | v4.0 | 0/TBD | Not started | - |

---
*Last updated: 2026-03-18 — v4.0 roadmap created*
