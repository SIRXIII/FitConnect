# FitRush

## What This Is

A luxury fitness marketplace that connects certified personal trainers' idle hours with clients at optimized (discounted) rates. Trainers earn from sessions that would otherwise go unfilled. Clients access premium personal training below market rate. The platform sustains itself on a transparent 8% booking fee, subscription tiers (Pro $9/mo, Elite $29/mo), and grows via referral incentives. Features a premium UX with skeleton loading, animated booking wizard, calendar sync, and rich client profiles ("Fitness Passport").

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

### Active (next milestone — TBD)

- [ ] Fix cascading slot deletion with soft-delete
- [ ] Move hardcoded 8% platform fee to configurable DB setting
- [ ] Replace console.log errors with user-facing toast notifications
- [ ] Add GDPR capabilities (account deletion, data export)
- [ ] Google Calendar OAuth bidirectional sync
- [ ] AI-powered trainer-client matching based on Fitness Passport data
- [ ] Subscription pause (CHURN-01)
- [ ] Contextual upgrade modals at tier gates (CHURN-02)
- [ ] Elite custom profile URL/slug (BRAND-01)
- [ ] Proration preview before mid-cycle upgrade (UX-01)
- [ ] In-app invoice history (UX-02)

### Out of Scope

- Predictive AI / ML models — Requires 6-12 months of booking data to train
- Dynamic auto-pricing — Complex, defer until demand data exists
- Mobile native apps — Web-first, PWA later
- Video sessions / virtual training — Focus on in-person marketplace first
- Multi-language / i18n — US market first

## Context

**Current state (v3.0 shipped — 2026-03-18):**
- React 19 + TypeScript + Vite 6 SPA — ~17,700 LOC
- Supabase PostgreSQL backend — 22 migrations deployed
- 14 Edge Functions: create-payment-intent, stripe-webhook, create-connect-account, send-notification-email, create-payout, weekly-payouts, process-referral-reward, create-setup-intent, cancel-booking, export-user-data, create-subscription, manage-subscription, admin-set-tier-override, calendar-export
- Stripe Connect Express + Stripe Billing (subscriptions, trials, dunning, Customer Portal)
- Calendar system: RFC 5545 iCal export with token-based auth, buffer time enforcement
- Fitness Passport: client profile intake with avatar upload, trainer-visible summary
- UX layer: skeleton loading, ErrorState + mapError, booking wizard with AnimatePresence
- 86 TS/TSX files, 14+ test files (Vitest)
- Supabase project: qecwxvvlpvrnrqyrdxrj (fitrush-app.netlify.app)

**Codebase health:**
- All critical security issues resolved (RLS verified, Zod validation on all forms, audit log active)
- Automated test coverage growing (Vitest configured, skeleton/error/image/booking tests)
- Known tech debt: TypeScript `as unknown as X` casts for Supabase RPC types, hardcoded 8% platform fee

**Competitive landscape:**
- Fyt (primary competitor): dumps full calendar to clients, no idle hour optimization
- FitRush differentiator: only show genuinely idle slots, AI-driven scheduling insights, referral flywheel, rich client profiles

## Constraints

- **Tech Stack**: React 19, Supabase, Stripe, Vite 6 — established, don't change
- **Design System**: Cormorant Garamond + Inter + #C5A059 gold — luxury brand identity locked
- **Database**: Supabase PostgreSQL with 22 migrations — additive changes only
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

## Completed Milestones

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
*Last updated: 2026-03-18 after v3.0 milestone*
