# Project Milestones — FitConnect

## v4.0 The Live Platform (Shipped: 2026-03-20)

**Phases completed:** 9 phases, 24 plans, 9 tasks

**Key accomplishments:**
- (none recorded)

---

## Milestone v3.0 — The Premium Experience & Trust Update ✅

**Status:** Complete
**Shipped:** 2026-03-18
**Phases:** 17–20 (4 phases + 16.1 hotfix · 12 plans)
**Codebase at ship:** ~17,700 LOC TypeScript/SQL · 14 Edge Functions · 22 migrations
**Timeline:** 2 days (2026-03-17 → 2026-03-18)

### What Shipped

| Phase | Name | Plans | Summary |
|-------|------|-------|---------|
| **16.1** | **QA Hotfix** | 1/1 ✅ | 404 page, protected onboarding routes, mobile hero contrast, footer links, console error silencing |
| **17** | **Security Hardening** | 3/3 ✅ | RLS audit (40+ policies verified), Zod validation expanded 3→9 schemas, audit log table + triggers + admin viewer; 5/7 SEC requirements pre-existing |
| **18** | **Trainee Fitness Passport** | 3/3 ✅ | Client avatar upload + canvas compression, bio field, Fitness Passport intake form, trainer-visible passport on booking detail |
| **19** | **Calendar Export & Buffer Times** | 3/3 ✅ | iCal .ics export Edge Function (RFC 5545), live feed URL with opaque token, buffer time config (0–60 min), server-side enforcement in trigger + RPC |
| **20** | **UX Polish** | 3/3 ✅ | Skeleton loading primitives (3 base + 3 page-specific), ErrorState + mapError, image lazy loading + Unsplash optimization, booking wizard redesign (628→351 LOC) |

### Key Accomplishments

- Security hardening: RLS audit verified 40+ policies, Zod validation expanded from 3 to 9 schemas (trainer/client profiles, fitness passport, admin overrides, bookings, buffer times), audit log with SECURITY DEFINER triggers on 4 tables
- Trainee Fitness Passport: client avatar upload with 400x400 canvas compression, bio/description field, fitness intake (goals, workout types, frequency, limitations), trainer-visible passport summary on booking detail page
- Calendar system: RFC 5545 VCALENDAR Edge Function with token-based auth (no JWT required), live iCal feed for Google/Apple Calendar subscription, buffer time enforcement (server-side rejection + slot visibility filtering)
- UX overhaul: booking flow refactored into 4-step wizard with Framer Motion AnimatePresence transitions and numbered progress indicator; 12+ pages migrated from spinners to content-shaped skeletons; all images lazy-loaded with Unsplash width optimization; ErrorState with mapError replacing raw error.message strings
- QA hotfix cycle: Playwright-driven testing identified 5 bugs across 12 routes, all fixed in Phase 16.1 before milestone work began

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 5/7 SEC requirements pre-existing | Security audit found JWT, SQL injection, RLS, payment, refunds already handled | ✓ Good — reduced Phase 17 scope |
| Canvas-based avatar compression (400x400, JPEG 0.7) | Client-side before upload; no server processing needed | ✓ Good |
| Secondary query for client_profiles on booking detail | No FK from bookings to client_profiles; separate fetch keeps query simple | ✓ Good |
| Opaque calendar_export_token (not trainer UUID) | Prevents ID enumeration; resettable without affecting trainer account | ✓ Good |
| SECURITY DEFINER for calendar Edge Function | Token-based auth bypasses JWT; function runs as owner with restricted search_path | ✓ Good |
| BookingWizard receives PaymentForm as component prop | Preserves Stripe Elements context boundary; avoids re-init on step change | ✓ Good |
| Transient spinners preserved on submit buttons | Skeleton screens only replace content-loading spinners, not action feedback | ✓ Good |

### Deferred to v3.1+

- Google Calendar OAuth bidirectional sync (requires consent screen verification)
- AI-powered trainer-client matching based on Fitness Passport data
- Trainer profile photo upload (focus on client avatars first)
- Subscription pause (CHURN-01)
- Contextual upgrade modals at tier gates (CHURN-02)

---

## Milestone v2.1 — Subscription Tiers ✅

**Status:** Complete
**Shipped:** 2026-03-17
**Phases:** 12–16 (5 phases · 15 plans)
**Codebase at ship:** ~15,239 LOC TypeScript/SQL · 13 Edge Functions · 18 migrations
**Timeline:** 2 days (2026-03-15 → 2026-03-17)

### What Shipped

| Phase | Name | Plans | Summary |
|-------|------|-------|---------|
| **12** | **Subscription Foundation** | 2/2 ✅ | DB schema (10 columns), write-guard trigger, get_visible_slots RPC, Stripe Dashboard config |
| **13** | **Billing Backend** | 3/3 ✅ | create-subscription, stripe-billing-webhook, manage-subscription, trial-end email, admin MRR RPC |
| **14** | **Feature Gates + Search** | 4/4 ✅ | tierGates.ts, useTier/useCan hooks, bio trigger, slot visibility, analytics gating, tier ranking, FeaturedTrainers |
| **15** | **Subscription UI** | 3/3 ✅ | Pricing page, trial activation, trial banner, subscription management tab, downgrade modal |
| **16** | **Admin Subscription Visibility** | 3/3 ✅ | Tier badges in user list, manual tier override Edge Function, MRR + subscriber analytics cards |

### Key Accomplishments

- Full Stripe Billing integration: 30-day free trial (no card), monthly/annual billing, webhook-driven tier sync, dunning automation
- 3-tier feature gate system: Free (3 slots, 280-char bio), Pro (10 slots, 1000-char bio, priority search), Elite (unlimited slots, featured on landing page)
- Subscription UI: public pricing page with billing toggle, trial countdown banner, in-app subscription management, downgrade confirmation with feature-loss preview
- Admin subscription visibility: tier badges per trainer, manual tier override (service_role bypass), MRR/subscriber/trial analytics cards
- All 20 v2.1 requirements delivered and verified across 4 categories (Billing, Tiers, Search, Admin)

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `guard_subscription_tier_write` trigger | Prevent auth-role writes to subscription_tier — only webhook/service_role can modify | ✓ Good |
| Frontend sends `{tier, interval}`, backend resolves PRICE_MAP | No VITE_STRIPE_PRICE_ env vars needed; single source of truth in Edge Function | ✓ Good |
| 2-second webhook delay after trial start | Stripe webhook takes 1-3s to fire; delay before fetchProfile prevents stale data | ✓ Good |
| TrialBanner returns null when !trainerProfile | Prevents banner flash on initial page load while profile is fetching | ✓ Good |
| admin-set-tier-override uses service_role | Bypasses write-guard trigger; admin identity verified via JWT before service_role write | ✓ Good |
| Serialize App.tsx and AdminDashboard.tsx modifications across waves | Prevents parallel file conflict in wave-based execution | ✓ Good |
| active_trial_count as separate migration | Keeps analytics data source consistent — all metrics from one RPC call | ✓ Good |

### Deferred to v2.1.x

- CHURN-01: Subscription pause (Stripe pause collection)
- CHURN-02: Contextual upgrade modals at tier gates
- BRAND-01: Elite custom profile URL/slug
- UX-01: Proration preview before mid-cycle upgrade
- UX-02: In-app invoice history
- SEC-01: Phone verification at trial start

---

## Milestone v2.0 — Monetization Sprint ✅

**Status:** Complete
**Shipped:** 2026-03-15
**Phases:** 9, 10, 11 (3 phases · 11 plans)
**Git range:** `3f637f8` → `afdcbde` (92 files changed, 12,295 insertions)
**Codebase at ship:** 8,942 LOC TypeScript · 10 Edge Functions · 14 migrations

### What Shipped

| Phase | Name | Plans | Commits |
|-------|------|-------|---------|
| **9** | **Trainer Payout System** | 3/3 ✅ | `3f637f8`–`45e16db` |
| **10** | **Earnings Analytics** | 4/4 ✅ | `f43b970`–`c39394f` |
| **11** | **Referral Program v1** | 4/4 ✅ | `7aa59e8`–`815c277` |

### Key Accomplishments

- Full trainer payout flow: on-demand (≥$50 min) + weekly pg_cron auto-payout, Stripe `transfers.create`, Resend initiation + arrival emails
- Trainer earnings dashboard: time-range selector (week/month/quarter/year), gross/net cards, AreaChart + BarChart trends, 7×24 peak-hours heatmap, CSV export
- Admin aggregate analytics: platform revenue, total payouts, booking volume, top earners table — all time-filtered via Postgres RPC
- Referral attribution pipeline: cookie capture on landing → signup linkage → idempotent `process-referral-reward` Edge Function → $10 payout credit or $5 booking discount
- ReferralLeaderboard on landing page; ReferralWidget on both trainer and client dashboards
- All 18 v2.0 requirements delivered and human-verified

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stripe `transfers.create` not `payouts.create` | Transfers move funds to Connect account balance (not bank) — correct for destination charges | ✓ Good |
| Email failure non-blocking in create-payout | Payout must complete even if Resend fails — email is secondary signal | ✓ Good |
| `weekly-payouts` validates service-role token directly | System function called only by pg_cron — no user JWT needed | ✓ Good |
| Vault secrets, not migration constants | Production secrets via `vault.decrypted_secrets` — comments document setup | ✓ Good |
| `payout.paid` ambiguity guard: skip if multiple processing | Stripe bundles transfers into one payout — 1:1 mapping unavailable | ✓ Good |
| `discount_adoption_pct` via `rate_charged < optimized_rate` | Most reliable schema signal for "discount applied" | ✓ Good |
| `SameSite=Lax` for referral cookie | Survives OAuth redirect round-trip — Strict breaks cross-origin returns | ✓ Good |
| `handle_new_user` trigger generates `referral_code` inline | All signups get code at profile creation regardless of path | ✓ Good |
| `referral_discount_trainer_id=null` — $5 off any trainer | Simpler UX — discount isn't locked to referred trainer | ✓ Good |
| `process-referral-reward` fire-and-forget in TrainerBookings | UI never blocked by referral processing | ✓ Good |

### Deferred to v2.1

- Phase 12: Subscription Tiers — Pro ($9/mo) + Elite ($29/mo), Stripe Billing, feature gates

---

## Milestone v1.0 — Feature Complete + iOS Ready ✅

**Status:** Complete
**Duration:** ~1.5 months (from initial design through Phase 8 + iOS wrapping)
**Team:** Claude (research, design, implementation, verification)

### Phases Shipped

| # | Name | Commits | Status |
|---|------|---------|--------|
| 1 | Payment & Security Hardening | — | Deferred (Phases 5–8 prioritized for App Store) |
| 2 | Input Validation & Error Handling | — | Deferred |
| 3 | Platform Config & Data Integrity | — | Deferred |
| 4 | Discount System | — | Deferred |
| **5** | **Admin Dashboard** | ✅ Phase complete | **Live** |
| **6** | **In-App Messaging** | ✅ Phase complete | **Live** |
| **7** | **AI Scheduling MVP** | `78bffab` | **Live** |
| **8** | **Enhanced Reviews** | `de9f155` | **Live** |
| **iOS** | **Capacitor Wrapping** | `6ef67b2` | **Ready for Xcode build** |

### Key Commits

| Commit | Phase | Feature |
|--------|-------|---------|
| `78bffab` | Phase 7 | Idle slot classification + Best Deals section |
| `de9f155` | Phase 8 | Multi-dimensional reviews + trainer responses + admin moderation |
| `6ef67b2` | iOS | Capacitor 8 iOS project scaffold + config |

### What's Live in v1.0

**User-Facing Features:**
- Trainer search + filtering (location, availability, discounts)
- Booking flow with Stripe payment
- Trainer profiles with reviews + idle time visibility
- In-app real-time messaging between trainers and clients
- Best Deals section highlighting discounted trainers
- Reviews system: sub-ratings (punctuality/expertise/communication) + trainer responses

**Admin Features:**
- `/admin` dashboard with role-based access control
- Analytics tab: bookings, revenue, active users, avg discount
- Users tab: list, search, suspend/unsuspend
- Reviews tab: flag moderation, hide/restore reviews
- Settings tab: platform fee adjustment
- System health status panel

**Infrastructure:**
- Supabase PostgreSQL with RLS policies
- Stripe Connect (trainer account creation ready)
- Edge Functions for payment intent + notifications
- Realtime messaging via Supabase Realtime
- iOS app wrapped in Capacitor 8, ready for App Store

### What's Deferred (Phases 1–4)

These are critical but were deprioritized to ship user-facing features:
- **Phase 1:** Payment security hardening (race condition fixes, input sanitization, RLS audit)
- **Phase 2:** Form validation (Zod schemas) + error handling UI
- **Phase 3:** Platform settings UI + data integrity (soft delete, GDPR export)
- **Phase 4:** Discount system UI (trainer dashboard) + weighted ranking

**Plan:** Execute Phases 1–4 in v1.1 patch release before major marketing push.

---

## Build Verification (v1.0)

All builds verified clean on 2026-03-14:
```
✓ npm run build — 1.45s, zero errors
✓ Phase 5–8 files present and functional
✓ iOS project structure complete (Capacitor 8)
✓ Capacity sync successful, web assets copied
```

---

*Last updated: 2026-03-15 after v2.0 milestone*
*Commits verified: `78bffab`, `de9f155`, `6ef67b2`, `3f637f8`–`815c277`*
