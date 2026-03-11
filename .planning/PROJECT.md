# FitConnect

## What This Is

A luxury fitness marketplace that connects certified personal trainers' idle hours with clients at optimized (discounted) rates. Trainers fill dead calendar time, clients get premium training at reduced prices. Both sides win through smart scheduling and transparent pricing.

## Core Value

Trainers monetize their idle hours at optimized rates while clients access certified personal training at below-market prices — the platform succeeds when dead hours become booked sessions.

## Requirements

### Validated

- ✓ OAuth authentication (Google, Facebook, Apple) via Supabase Auth — existing
- ✓ Role-based access control (trainer/client) with protected routes — existing
- ✓ User profiles with role selection onboarding — existing
- ✓ Trainer profiles with specialty, bio, hourly rate, location, certifications — existing
- ✓ Trainer search with filtering by specialty, rate, location — existing
- ✓ Availability slot management (create single/bulk weekly slots) — existing
- ✓ Multi-step booking flow (review → confirm → payment) — existing
- ✓ Stripe Connect payment processing with platform fee — existing
- ✓ Client booking history with upcoming/past views — existing
- ✓ Basic reviews with star rating and comments — existing
- ✓ Real-time notifications via Supabase Realtime — existing
- ✓ Trainer dashboard with stats, Stripe Connect setup — existing
- ✓ Luxury design system (Cormorant Garamond, Inter, muted gold accent) — existing

### Active

- [ ] Fix payment race condition (booking before payment confirmation)
- [ ] Fix SQL injection vector in trainer search (ilike)
- [ ] Verify and harden RLS policies across all tables
- [ ] Add JWT verification to all Edge Functions
- [ ] Move GEMINI_API_KEY to server-side only
- [ ] Implement cancellation refund logic via Stripe
- [ ] Add Zod input validation for all user-facing forms
- [ ] Fix cascading slot deletion with soft-delete
- [ ] Move hardcoded 8% platform fee to configurable DB setting
- [ ] Replace console.log errors with user-facing toast notifications
- [ ] Add GDPR capabilities (account deletion, data export)
- [ ] Trainer discount slider (5%–80% range) with real-time rate preview
- [ ] Discount-based weighted ranking (discount 40%, rating 25%, proximity 20%, availability 15%)
- [ ] Admin dashboard with user management, analytics, platform settings
- [ ] In-app messaging between trainers and clients via Supabase Realtime
- [ ] AI scheduling MVP — classify hours as BOOKED/BLOCKED/BUFFER/IDLE
- [ ] Multi-dimensional review ratings (punctuality, expertise, communication)
- [ ] Trainer review responses and review moderation

### Out of Scope

- External calendar sync (Google/Apple/Outlook) — Phase 2 of AI scheduling concept, needs significant calendar API work
- Predictive AI / ML models — Requires 6-12 months of booking data to train
- Dynamic auto-pricing — Complex, defer until demand data exists
- Mobile native apps — Web-first, PWA later
- Video sessions / virtual training — Focus on in-person marketplace first
- Multi-language / i18n — US market first

## Context

**Existing codebase (Milestone 1 complete):**
- React 19 + TypeScript + Vite 6 SPA
- Supabase PostgreSQL backend with 9 migrations deployed
- 4 Edge Functions: create-payment-intent, stripe-webhook, create-connect-account, send-notification-email
- Stripe Connect Express accounts with destination charges
- Tailwind CSS v4 with luxury design tokens
- Zustand v5 for auth state, custom hooks for data fetching
- Supabase project: qecwxvvlpvrnrqyrdxrj

**Codebase health:**
- 23 identified concerns: 5 critical, 6 high, 7 medium, 3 low
- Critical issues: payment race condition, SQL injection via ilike, unverified RLS, Edge Function auth gaps, client-exposed API key
- No tests, no CI/CD, console-only error handling

**Competitive landscape:**
- Fyt (primary competitor): dumps full calendar to clients, no idle hour optimization
- FitConnect differentiator: only show genuinely idle slots, AI-driven scheduling insights

## Constraints

- **Tech Stack**: React 19, Supabase, Stripe, Vite 6 — established, don't change
- **Design System**: Cormorant Garamond + Inter + #C5A059 gold — luxury brand identity locked
- **Security**: Fix all critical/high concerns before adding new features
- **Database**: Supabase PostgreSQL with existing 9 migrations — additive changes only
- **Payments**: Stripe Connect Express accounts — existing integration
- **Budget**: Supabase free/pro tier, Stripe standard pricing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security-first approach | 5 critical concerns including payment race conditions and SQL injection | — Pending |
| Discount slider 5%–80% range | Balance between meaningful discount and trainer viability | — Pending |
| Weighted-blend ranking (40/25/20/15) | Incentivize discounts while rewarding quality and proximity | — Pending |
| AI scheduling MVP = hour classification only | Smart filtering alone differentiates from Fyt without ML | — Pending |
| Skip external calendar sync | Complex API integration, deliver core value first | — Pending |

---
*Last updated: 2026-03-11 after Milestone 2 initialization*
