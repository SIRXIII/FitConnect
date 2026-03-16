# FitRush

## What This Is

A luxury fitness marketplace that connects certified personal trainers' idle hours with clients at optimized (discounted) rates. Trainers earn from sessions that would otherwise go unfilled. Clients access premium personal training below market rate. The platform sustains itself on a transparent 8% booking fee and grows via referral incentives.

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

### Active (v2.1 — Subscription Tiers)

- [ ] Trainer can subscribe to Pro tier ($9/month) for priority search placement and advanced analytics
- [ ] Trainer can subscribe to Elite tier ($29/month) for custom branding and featured section
- [ ] Stripe Billing integration: automatic recurring charges, upgrade/downgrade UI, invoice history
- [ ] Feature gates: free (3 slots visible), Pro (10 slots, custom bio), Elite (unlimited, branded)

### Deferred (v1.1 security patch — still pending before major marketing push)

- [ ] Fix payment race condition (booking before payment confirmation)
- [ ] Fix SQL injection vector in trainer search (ilike)
- [ ] Verify and harden RLS policies across all tables
- [ ] Add JWT verification to all Edge Functions
- [ ] Implement cancellation refund logic via Stripe
- [ ] Add Zod input validation for all user-facing forms
- [ ] Fix cascading slot deletion with soft-delete
- [ ] Move hardcoded 8% platform fee to configurable DB setting
- [ ] Replace console.log errors with user-facing toast notifications
- [ ] Add GDPR capabilities (account deletion, data export)
- [ ] Discount-based weighted ranking

### Out of Scope

- External calendar sync (Google/Apple/Outlook) — Phase 2 of AI scheduling concept, needs significant calendar API work
- Predictive AI / ML models — Requires 6-12 months of booking data to train
- Dynamic auto-pricing — Complex, defer until demand data exists
- Mobile native apps — Web-first, PWA later
- Video sessions / virtual training — Focus on in-person marketplace first
- Multi-language / i18n — US market first

## Context

**Current state (v2.0 shipped — 2026-03-15):**
- React 19 + TypeScript + Vite 6 SPA — 8,942 LOC
- Supabase PostgreSQL backend — 14 migrations deployed
- 10 Edge Functions: create-payment-intent, stripe-webhook, create-connect-account, send-notification-email, create-payout, weekly-payouts, process-referral-reward, create-setup-intent, cancel-booking, export-user-data
- Stripe Connect Express accounts with destination charges + Stripe transfers for payouts
- 3 Postgres analytics RPCs: `get_trainer_analytics`, `get_trainer_analytics_trend`, `get_admin_analytics`
- Referral system: `referrals` table, `referral_code` on profiles, leaderboard RPC, cookie attribution
- Tailwind CSS v4 with luxury design tokens
- Zustand v5 for auth state, custom hooks for data fetching
- Supabase project: qecwxvvlpvrnrqyrdxrj (fitrush-app.netlify.app)

**Codebase health:**
- v1.1 security issues partially addressed: GEMINI key moved server-side, discount slider added, orphaned booking cleanup cron, Edge Function auth added
- Remaining critical: payment race condition, SQL injection via ilike, full RLS audit, cancellation refund
- No automated tests, no CI/CD pipeline

**Competitive landscape:**
- Fyt (primary competitor): dumps full calendar to clients, no idle hour optimization
- FitRush differentiator: only show genuinely idle slots, AI-driven scheduling insights, referral flywheel

## Constraints

- **Tech Stack**: React 19, Supabase, Stripe, Vite 6 — established, don't change
- **Design System**: Cormorant Garamond + Inter + #C5A059 gold — luxury brand identity locked
- **Security**: Fix remaining critical/high concerns before major marketing push
- **Database**: Supabase PostgreSQL with existing 14 migrations — additive changes only
- **Payments**: Stripe Connect Express accounts — existing integration
- **Budget**: Supabase free/pro tier, Stripe standard pricing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security-first approach | 5 critical concerns flagged at v1.0 | ⚠️ Revisit — Phase 01 partial, remainder still pending |
| Discount slider 5%–80% range | Balance between meaningful discount and trainer viability | ✓ Good — shipped |
| Weighted-blend ranking (40/25/20/15) | Incentivize discounts while rewarding quality and proximity | — Pending |
| AI scheduling MVP = hour classification only | Smart filtering alone differentiates from Fyt without ML | ✓ Good |
| Skip external calendar sync | Complex API integration, deliver core value first | ✓ Good |
| Stripe `transfers.create` not `payouts.create` | Transfers move funds to Connect account balance — correct for destination charges | ✓ Good |
| Email failure non-blocking in payouts | Payout must complete even if Resend fails | ✓ Good |
| `weekly-payouts` validates service-role token directly | System function called only by pg_cron — no user JWT needed | ✓ Good |
| Vault secrets for pg_cron | No hardcoded keys in migrations — read at runtime via vault.decrypted_secrets | ✓ Good |
| `SameSite=Lax` for referral cookie | Survives OAuth redirect round-trip; Strict breaks cross-origin returns | ✓ Good |
| `handle_new_user` trigger generates `referral_code` | All signups auto-get code regardless of path | ✓ Good |
| Referral $5 discount applies to any trainer | Simpler UX — not locked to referred trainer | ✓ Good |
| Subscription tiers deferred to v2.1 | Deliver cash flow (payouts) and growth (referrals) first | ✓ Good |

## Current Milestone: v2.1 — Subscription Tiers

**Goal:** Monetize trainer engagement with Pro and Elite subscription plans.

**Target features:**
- Pro tier ($9/mo): priority search placement + advanced analytics
- Elite tier ($29/mo): custom branding + featured section placement
- Stripe Billing: automatic recurring, upgrade/downgrade, invoices
- Feature gates across free/Pro/Elite tiers

---
*Last updated: 2026-03-15 after v2.0 milestone*
