# FitRush

## What This Is

A luxury fitness marketplace that connects certified personal trainers' idle hours with clients at optimized (discounted) rates — now featuring real-time trainer availability, Google Maps discovery, AI-powered trainer matching, and Google Calendar sync. Trainers earn from sessions that would otherwise go unfilled with AI analytics showing which slots need attention. Clients access premium personal training below market rate with location-based alerts when nearby trainers go live. The platform sustains itself on a transparent 8% booking fee, subscription tiers (Pro $9/mo, Elite $29/mo), and grows via referral incentives.

## Core Value

Trainers monetize their idle hours at optimized rates while clients access certified personal training at below-market prices — the platform succeeds when dead hours become booked sessions.

## Requirements

### Validated

- ✓ OAuth authentication (Google, Facebook, Apple) via Supabase Auth — v1.0
- ✓ Role-based access control (trainer/client) with protected routes — v1.0
- ✓ User profiles with role selection onboarding — v1.0
- ✓ Trainer profiles with specialty, bio, hourly rate, location, certifications — v1.0
- ✓ Trainer search with filtering by specialty, rate, location — v1.0
- ✓ Availability slot management (create single/bulk weekly slots) — v1.0
- ✓ Multi-step booking flow (review → confirm → payment) — v1.0
- ✓ Stripe Connect payment processing with platform fee — v1.0
- ✓ Client booking history with upcoming/past views — v1.0
- ✓ Basic reviews with star rating and comments — v1.0
- ✓ Real-time notifications via Supabase Realtime — v1.0
- ✓ Trainer dashboard with stats, Stripe Connect setup — v1.0
- ✓ Luxury design system (Cormorant Garamond, Inter, muted gold accent) — v1.0
- ✓ Trainer payout dashboard (available balance, pending balance, transaction history) — v2.0
- ✓ On-demand payout initiation when balance ≥ $50 — v2.0
- ✓ Weekly auto-payout every Monday for trainers with balance ≥ $50 — v2.0
- ✓ Accurate balance calculation (completed bookings - platform fee - Stripe fees) — v2.0
- ✓ Payout email notifications (initiated + completed) — v2.0
- ✓ Trainer earnings dashboard with time range picker + charts — v2.0
- ✓ Admin aggregate analytics (platform revenue, payouts, booking volume, top earners) — v2.0
- ✓ CSV export of trainer earnings for tax purposes — v2.0
- ✓ Referral code generation (unique per user, shareable link) — v2.0
- ✓ Trainer referral: $10 payout credit when referred client books — v2.0
- ✓ Client referral: $5 discount when referred trainer's client books — v2.0
- ✓ Referral attribution (cookie → signup link → first-booking credit) — v2.0
- ✓ Referral leaderboard on landing page (top 10 this month) — v2.0
- ✓ Referral notifications (in-app + email) — v2.0

### Validated (v2.1)

- ✓ Trainer can subscribe to Pro tier ($9/month) for priority search placement and advanced analytics — v2.1
- ✓ Trainer can subscribe to Elite tier ($29/month) for featured section and unlimited slots — v2.1
- ✓ Stripe Billing integration: 30-day trial, monthly/annual billing, webhook-driven tier sync — v2.1
- ✓ Feature gates: Free (3 slots, 280-char bio), Pro (10 slots, 1000-char bio), Elite (unlimited) — v2.1
- ✓ Admin subscription visibility: tier badges, manual override, MRR analytics — v2.1

### Validated (v3.0)

- ✓ Security hardening: RLS audit (40+ policies), Zod validation (9 schemas), audit log with triggers — v3.0
- ✓ Client avatar upload with canvas compression (400x400, JPEG 0.7) — v3.0
- ✓ Client bio/description field (500 chars) — v3.0
- ✓ Fitness Passport intake: goals, workout types, frequency, limitations — v3.0
- ✓ Trainer-visible Fitness Passport on booking detail — v3.0
- ✓ iCal .ics export + live feed URL with opaque token — v3.0
- ✓ Buffer time configuration (0–60 min) with server-side enforcement — v3.0
- ✓ Skeleton loading screens replacing spinners across 12+ pages — v3.0
- ✓ Actionable error states with mapError + retry buttons — v3.0
- ✓ Booking wizard redesign with progress indicator + Framer Motion transitions — v3.0
- ✓ Image optimization: lazy loading + Unsplash width params — v3.0

### Validated (v4.0)

- ✓ Google Maps map view with trainer pins, clustering, and PostGIS spatial queries — v4.0
- ✓ Trainer workout location management (address entry + map preview, gym/park/in-home) — v4.0
- ✓ Uber-style trainer availability toggle with sleep timer auto-off — v4.0
- ✓ Location-based notifications for clients (saved area + live GPS "Looking Now" mode) — v4.0
- ✓ AI trainer-client matching based on Fitness Passport data (deterministic scoring) — v4.0
- ✓ AI trainer analytics with idle slot heatmap and discount recommendations — v4.0
- ✓ Google Calendar OAuth bidirectional sync (push bookings, block external events) — v4.0
- ✓ Session logging with trainer notes, exercise data, and client progress timeline — v4.0
- ✓ Landing page email capture with Resend confirmation — v4.0
- ✓ Client fitness profile enhancement (health conditions, intensity, goals, progress ring) — v4.0

### Active (v5.0 — next milestone)

- [ ] AI Marketing Tier — social media content tools for trainers
- [ ] Push notifications (FCM/APNs) — real mobile push
- [ ] Group sessions — multiple clients per time slot
- [ ] Fix cascading slot deletion with soft-delete
- [ ] Move hardcoded 8% platform fee to configurable DB setting
- [ ] Subscription pause (CHURN-01)
- [ ] Contextual upgrade modals at tier gates (CHURN-02)
- [ ] Elite custom profile URL/slug (BRAND-01)

### Out of Scope

- Predictive AI / ML models — Requires 6-12 months of booking data to train
- Dynamic auto-pricing — Complex, defer until demand data exists
- Video sessions / virtual training — Focus on in-person marketplace first
- Multi-language / i18n — US market first
- Background location tracking — iOS App Store rejection risk

## Context

**Current state (v4.0 shipped — 2026-03-20):**
- React 19 + TypeScript + Vite 6 SPA — ~31,000 LOC (+13,300 in v4.0)
- Supabase PostgreSQL backend — 31 migrations (11 new in v4.0), PostGIS enabled
- 17 Edge Functions (+3 in v4.0): google-calendar-connect, sync-booking-to-gcal, sync-gcal-events
- Stripe Connect Express + Stripe Billing (subscriptions, trials, dunning, Customer Portal)
- Google Maps integration with @vis.gl/react-google-maps, marker clustering, PostGIS spatial queries
- Google Calendar OAuth bidirectional sync (push + poll + cancellation)
- AI matching: deterministic scoring (price 40%, goals 35%, specialty 15%, rating 10%)
- AI analytics: idle slot heatmap, discount recommendation engine, utilization score
- Location notifications: PostGIS trigger, 3/day cap, 4hr cooldown, "Looking Now" GPS mode
- Session logging: trainer notes, exercise data, client progress timeline
- 139/140 tests passing (Vitest)
- Supabase project: qecwxvvlpvrnrqyrdxrj (fitrush-app.netlify.app)

**Codebase health:**
- All critical security issues resolved (RLS verified, Zod validation, audit log)
- 139 automated tests passing, 1 pre-existing admin grid test needs update
- Known tech debt: TypeScript `as unknown as X` casts for Supabase RPC types, hardcoded 8% platform fee, Google OAuth in test mode (100-user cap until verification approved)

**Competitive landscape:**
- Fyt (primary competitor): dumps full calendar to clients, no idle hour optimization
- FitRush differentiators: real-time availability with map view, AI matching from fitness profiles, location-based alerts, Google Calendar sync, referral flywheel, discount analytics

## Constraints

- **Tech Stack**: React 19, Supabase, Stripe, Vite 6 — established, don't change
- **Design System**: Cormorant Garamond + Inter + #C5A059 gold — luxury brand identity locked
- **Database**: Supabase PostgreSQL with 31 migrations + PostGIS — additive changes only
- **Payments**: Stripe Connect Express + Stripe Billing — existing integration
- **Budget**: Supabase free/pro tier, Stripe standard pricing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security-first approach | 5 critical concerns flagged at v1.0 | ✓ Good — all resolved in v3.0 Phase 17 |
| Discount slider 5%–80% range | Balance between meaningful discount and trainer viability | ✓ Good — shipped |
| AI scheduling MVP = hour classification only | Smart filtering alone differentiates from Fyt without ML | ✓ Good |
| Stripe `transfers.create` not `payouts.create` | Transfers move funds to Connect account balance — correct for destination charges | ✓ Good |
| `guard_subscription_tier_write` trigger | Only webhook/service_role can modify subscription_tier | ✓ Good — v2.1 |
| Canvas-based avatar compression (400x400, JPEG 0.7) | Client-side before upload; no server processing needed | ✓ Good — v3.0 |
| Opaque calendar_export_token (not trainer UUID) | Prevents ID enumeration; resettable | ✓ Good — v3.0 |
| BookingWizard PaymentForm as component prop | Preserves Stripe Elements context boundary | ✓ Good — v3.0 |
| Skeleton screens only for content-loading | Transient spinners preserved on submit buttons for action feedback | ✓ Good — v3.0 |
| PostGIS for spatial queries | ST_DWithin radius matching, trainers_in_view RPC | ✓ Good — v4.0 |
| PG trigger for location notifications | Zero-latency, free-tier safe, no pg_net needed | ✓ Good — v4.0 |
| Deterministic AI matching (no ML) | Price/goals/specialty/rating weights, explainable results | ✓ Good — v4.0 |
| GCal polling (15 min) over push notifications | Push channels expire in 7 days, require domain verification | ✓ Good — v4.0 |
| OAuth popup (not redirect) for GCal | Trainer stays in FitRush during connection | ✓ Good — v4.0 |
| Separate client_notification_preferences table | Keeps preferences private from trainers (RLS) | ✓ Good — v4.0 |

## Completed Milestones

<details>
<summary>v4.0 — The Live Platform (shipped 2026-03-20)</summary>

Phases 21–28 + 23.1 (9 phases, 24 plans, 44 requirements). See `.planning/MILESTONES.md`.
</details>

<details>
<summary>v3.0 — The Premium Experience & Trust Update (shipped 2026-03-18)</summary>

Phases 16.1, 17–20 (4 phases + hotfix, 12 plans, 24 requirements). See `.planning/MILESTONES.md`.
</details>

<details>
<summary>v2.1 — Subscription Tiers (shipped 2026-03-17)</summary>

Phases 12–16 (5 phases, 15 plans, 20 requirements). See `.planning/MILESTONES.md`.
</details>

<details>
<summary>v2.0 — Monetization Sprint (shipped 2026-03-15)</summary>

Phases 9–11 (3 phases, 11 plans, 18 requirements). See `.planning/MILESTONES.md`.
</details>

<details>
<summary>v1.0 — Feature Complete (shipped ~2026-03-01)</summary>

Phases 5–8 (4 phases, ~12 plans). See `.planning/MILESTONES.md`.
</details>

---
*Last updated: 2026-03-20 after v4.0 milestone*
