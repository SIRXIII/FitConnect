---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Subscription Tiers
current_plan: 16-03 complete — all plans done
status: complete
stopped_at: Completed 16-03-PLAN.md
last_updated: "2026-03-17T04:23:55.904Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 15
  completed_plans: 15
---

# Project State — FitRush

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-15)

**Core value:** Trainers monetize idle hours, clients get premium training at below-market prices
**Current focus:** v2.1 — Subscription Tiers

## Current Position

**Phase:** 16 of 16 — Admin Subscription (COMPLETE)
**Current Plan:** 16-03 complete -- all plans done
**Status:** Complete

## Progress

```
v2.1 Phases:
Phase 12: Subscription Foundation  [x] COMPLETE (schema migration + Stripe config)
Phase 13: Billing Backend          [x] COMPLETE (webhook handler + subscription RPCs + MRR analytics)
Phase 14: Feature Gates + Search   [x] COMPLETE (tier hooks + bio trigger + slot RPC + dashboard gates + tier ranking + FeaturedTrainers)
Phase 15: Subscription UI          [x] COMPLETE (subscription helpers + pricing page + trial banner + subscription tab + downgrade modal)
Phase 16: Admin Subscription       [x] COMPLETE (subscription health metrics + tier badges + tier override)

Overall: [██████████] 100%
```

## Recent Decisions

| Decision | Date | Outcome |
|----------|------|---------|
| v2.0 = monetization sprint | 2026-03-14 | Payouts → Analytics → Referrals |
| Payout: weekly auto + on-demand | 2026-03-14 | $50 minimum threshold |
| Subscription tiers | 2026-03-14 | Deferred to v2.1 |
| Referral incentives | 2026-03-14 | $10 trainer credit / $5 client discount |
| Stripe transfers.create not payouts.create | 2026-03-14 | Transfers move funds to Connect account balance |
| Email failure is non-blocking in create-payout | 2026-03-14 | Payout completes even if Resend fails |
| weekly-payouts service-role auth: token === SUPABASE_SERVICE_ROLE_KEY | 2026-03-14 | System function, no user JWT needed |
| payout.paid ambiguity guard: skip if multiple processing transactions | 2026-03-14 | Log + defer vs. risk marking wrong transaction |
| Vault secrets NOT in migration file | 2026-03-14 | Comments document manual setup, secrets read at runtime |
| discount_adoption_pct uses rate_charged < optimized_rate | 2026-03-15 | Definition B — most reliable schema signal for "discount applied" |
| p_bucket passed as RPC param, mapped via getBucketParam() | 2026-03-15 | Avoids bucket/range mismatch; TS layer controls granularity |
| Admin analytics tab replaces static cards with time-filtered RPC data | 2026-03-14 | get_admin_analytics RPC drives all four metric cards and top earners table |
| AnalyticsTab reads trainerProfile from useAuthStore directly | 2026-03-15 | No props pattern, matches PayoutsTab convention |
| Heatmap intensity: rgba(45,45,45,N) where N = count/maxCount | 2026-03-15 | Opacity-based heat signal, no external color library needed |
| Phase 10 analytics complete — human verified trainer analytics, admin analytics, and CSV export | 2026-03-15 | All six ANALYTICS requirements delivered and verified |
| SameSite=Lax for referral cookie | 2026-03-15 | Survives OAuth redirect round-trip; Strict breaks cross-origin returns |
| Leaderboard RPC uses date_trunc('month', now()) | 2026-03-15 | Calendar month window — resets cleanly, not rolling 30 days |
| handle_new_user trigger generates referral_code inline | 2026-03-15 | All new signups get code at profile creation regardless of signup path |
| referral_discount_trainer_id=null — discount applies to any trainer | 2026-03-15 | $5 off next booking with any trainer, not locked to referred trainer |
| process-referral-reward idempotency via status-guard UPDATE | 2026-03-15 | .update(status='rewarded').eq(status,'pending').select('id') pattern — retry-safe without read-then-write |
| ReferralWidget placed after existing content in both dashboards | 2026-03-15 | Non-disruptive placement — overview tab end in TrainerDashboard, after quick actions in ClientDashboard |
| Attribution block single try/catch wraps both referrals.insert and notifications.insert | 2026-03-15 | Either both succeed or both fail silently — role selection never blocked |
| Discount consumed at booking insert time even if payment later fails | 2026-03-14 | One-time use discount — acceptable trade-off for simplicity |
| process-referral-reward call is fire-and-forget in TrainerBookings | 2026-03-14 | UI never blocked by referral processing; .catch prevents unhandled rejections |
| ReferralLeaderboard returns null when entries empty | 2026-03-14 | No empty section shown on landing before referrals are rewarded in production |
| Phase 11 referral program complete — human verified end-to-end | 2026-03-14 | All 6 REFERRAL requirements delivered across 4 plans |
| Phase 01 security hardening complete | 2026-03-15 | All 5 REQ-SEC requirements delivered — GEMINI key removed, input sanitized, RLS audited, orphaned booking cleanup, email Edge Function with JWT auth |
| send-notification-email stubs Resend — email failure is non-blocking | 2026-03-13 | Logs if no RESEND_API_KEY; returns 200 to caller regardless |
| cleanup_abandoned_bookings cancels (not deletes) stale pending bookings | 2026-03-13 | Preserves audit trail; slot sync triggers fire on status change |
| BEFORE UPDATE trigger guards subscription columns | 2026-03-16 | RLS cannot restrict individual columns; trigger with IS DISTINCT FROM is the only enforceable mechanism |
| SECURITY DEFINER for get_visible_slots | 2026-03-16 | Anonymous clients need slot visibility; SECURITY INVOKER would be blocked by restrictive anon RLS on availability_slots |
| tier_overridden_by references profiles(id) ON DELETE SET NULL | 2026-03-16 | Authoritative schema per research file — plan_split_guidance incorrectly specified bool tier_override |
| subscription_events insert only via service_role RLS | 2026-03-16 | Webhook Edge Functions write events; no direct client insert path needed |
| Billing webhook registered before Phase 13 deploys | 2026-03-16 | Stripe retries for 72h so events during Phase 12→13 gap are not lost |
| Dunning terminal action = Cancel (not past_due/unpaid) | 2026-03-16 | Required for customer.subscription.deleted to fire after payment exhaustion; trainers would retain paid features indefinitely otherwise |
| Separate billing endpoint from Connect stripe-webhook | 2026-03-16 | Each has its own whsec_ signing secret — prevents cross-event contamination |
| MRR is point-in-time snapshot — no date-range filter on subscription_stats CTE | 2026-03-16 | Reflects current active/trialing subscribers at call time; correct SaaS behavior |
| Trialing trainers included in MRR and subscriber counts | 2026-03-16 | Standard SaaS convention — trials represent committed pipeline revenue |
| Annual subscription prices hardcoded in SQL CASE (Pro $86.40/12, Elite $278.40/12) | 2026-03-16 | Supabase SQL functions cannot access env vars at runtime |
| create-subscription does not write subscription_tier/status | 2026-03-16 | Webhook is the single writer — writing in Edge Function causes race condition since customer.subscription.created fires within milliseconds |
| manage-subscription returns 400 for trainers with no stripe_customer_id | 2026-03-16 | Trainer exists but has never subscribed — 400 communicates actionable state ("start a trial first") |
| APP_URL falls back to https://app.fitrush.io in manage-subscription | 2026-03-16 | Safe default prevents portal return_url from being empty if env var not set |
| Trial bypass unconditional in useCan | 2026-03-16 | isTrialing=true grants full feature access regardless of tier — standard SaaS trial behavior |
| vi.mock('@/stores/auth') for hook isolation | 2026-03-16 | Avoids Supabase client initialization in test env; mockReturnValue per test case |
| Vitest config in vite.config.ts test block | 2026-03-16 | No separate vitest.config.ts — keeps config surface minimal; globals:true + jsdom |
| Bio trigger fires only on IS DISTINCT FROM OLD.bio | 2026-03-16 | Existing long bios preserved on trainer downgrade — trigger only gates new/changed bio content |
| supabase cast to any for get_visible_slots RPC | 2026-03-16 | Consistent with project-wide pattern for unregistered RPCs (same as get_referral_leaderboard, get_admin_analytics) |
| LockedFeatureBanner uses FEATURE_NAMES map for human-readable titles | 2026-03-16 | Avoids brittle string manipulation from label field; explicit map per TierFeature |
| Analytics tab label visible for all tiers (discovery UX) | 2026-03-16 | Only content is gated behind canAnalytics, not the tab button — users discover feature before upgrading |
| Slot hint uses tier === 'free' direct check (not useCan) | 2026-03-16 | Informational display about data visibility, not access control — useCan not appropriate here |
| tierScore IIFE in rankTrainers: elite=1.0, pro=0.67, free=0.0 at weight 0.20 | 2026-03-16 | New weights 0.35/0.20/0.15/0.10/0.20 — elite trainers surface above equivalent Free trainers |
| FeaturedTrainers self-hides via null vs [] distinction | 2026-03-16 | null=loading returns null, []=no elite trainers returns null — no conditional wrapper needed in Landing.tsx |
| PRICE_MAP uses env vars not hardcoded Stripe price IDs | 2026-03-17 | Deployment-safe -- same code works across Stripe test/live environments |
| callEdgeFunction is module-private, startTrial/getPortalUrl are public API | 2026-03-17 | Encapsulated fetch mechanism; only typed callers exposed |
| Backward compatibility preserved in create-subscription | 2026-03-17 | Still accepts raw priceId alongside new tier+interval path |
| PlanCard CTA 5-state machine | 2026-03-17 | free current, paid current, unauthenticated redirect, trial-eligible, already-subscribed |
| Default billing interval is monthly | 2026-03-17 | Lower sticker shock per research recommendation |
| /pricing is a public route | 2026-03-17 | Unauthenticated visitors discover pricing before signup |
| TrialBanner handles own null checks internally | 2026-03-17 | No loading selector needed -- prevents flash on first render |
| DowngradeModal confirm redirects to Stripe Portal | 2026-03-17 | Keeps billing state management in Stripe rather than calling cancel API directly |
| Tab initialization reads ?tab= query param | 2026-03-17 | Stripe Portal return auto-selects subscription tab via lazy useState initializer |
| Edge Function uses service_role to bypass guard_subscription_tier_write | 2026-03-17 | Admin override must bypass trigger that blocks non-webhook tier writes |
| Override column expands users table to 6 columns with inline selector | 2026-03-17 | free/pro/elite inline buttons with dismiss; override date subtext |
| UserRow cast uses as unknown as UserRow[] for trainer_profiles join | 2026-03-17 | Supabase types don't register profiles-to-trainer_profiles FK; matches existing FlaggedReview cast pattern |
| TierBadge em dash separator for compound labels | 2026-03-17 | Pro --- Trialing, Elite --- Past Due; 7-state color/label logic |

## Pending Todos

None

## Blockers / Concerns

- Phase 01 security hardening complete — v1.1 security work (Phases 1–4) partially resolved; Phases 2–4 still pending
- send-notification-email requires RESEND_API_KEY vault secret before email delivery goes live
- cleanup_abandoned_bookings should be connected to a pg_cron job or stripe-webhook for automated cleanup
- Stripe Connect accounts (trainer setup from v1.0) must be in place for Phase 9

## Session Continuity

Last session: 2026-03-17T04:23:55.899Z
Stopped at: Completed 16-03-PLAN.md
Resume with: `/gsd:execute-phase 16` (Phase 16 — Admin Subscription)
