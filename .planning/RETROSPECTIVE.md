# Project Retrospective — FitRush

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v2.0 — Monetization Sprint

**Shipped:** 2026-03-15
**Phases:** 3 (9, 10, 11) | **Plans:** 11 | **Timeline:** 2 days (2026-03-14 → 2026-03-15)
**Files:** 92 changed · 12,295 insertions · ~8,942 LOC at ship

### What Was Built

- **Payout system:** Full on-demand + auto-weekly payout flow via Stripe `transfers.create`, $50 minimum guard, pg_cron Monday schedule, Vault-backed credentials, Resend initiation + arrival emails
- **Earnings analytics:** Trainer dashboard with 4 time ranges, 5 metric cards (gross/net/bookings/avg price/discount%), 2 Recharts charts, 7×24 peak-hours heatmap, CSV export; Admin dashboard with platform-wide metrics + top earners table
- **Referral program:** Cookie attribution on landing → signup linkage → idempotent `process-referral-reward` Edge Function → $10 payout credit or $5 booking discount; ReferralWidget on dashboards; top-10 leaderboard on landing
- 3 Postgres analytics RPCs with security `definer` model and caller ownership validation
- 2 new Edge Functions (create-payout, weekly-payouts, process-referral-reward) + 5 new migrations

### What Worked

- **Phased dependency ordering:** Shipping payouts first (Phase 9) unblocked both analytics accuracy (Phase 10 needs real `payout_transactions` data) and referral credits (Phase 11 needs the credit mechanism). The dependency graph held perfectly.
- **DB-first thinking:** Writing migration + RPC before UI meant the UI plan could specify exact function signatures. Zero interface surprises.
- **Non-blocking email pattern:** Established in Phase 9 and reused in Phase 11 — email failures never block the primary operation. Consistent pattern across all 10 Edge Functions now.
- **Idempotency guard for referral rewards:** The `UPDATE status='rewarded' WHERE status='pending'` pattern elegantly prevents double-rewarding without requiring a separate existence check.
- **SameSite=Lax for OAuth-traversed cookies:** Learned and documented — prevents the subtle breakage where referral attribution vanishes after Google/Apple sign-in redirect.

### What Was Inefficient

- **Summary one-liner format mismatch:** `gsd-tools milestone complete` couldn't extract accomplishments because summaries use a custom YAML-frontmatter + markdown format rather than the `one_liner` JSON field the CLI expects. Had to add accomplishments manually to MILESTONES.md.
- **Phase 01 interleaving:** Phase 01 (security hardening) was executed in the same context as v2.0, adding noise to the commit history and state tracking. Future: keep security patches as a dedicated milestone or at least fully separate from feature milestones.
- **Mock trainer IDs in development:** Mock trainer IDs ('1', '2', '3') conflicting with UUID schema caused infinite spinner bug in production. The development data model diverged from the production schema — caught post-deploy rather than pre-ship.

### Patterns Established

- **Stripe system architecture:** `transfers.create` (not `payouts.create`) for Connect destination charges; `payout.paid` webhook for completion; `payout_transactions.payout_transaction_id` FK sweep-then-rollback pattern
- **pg_cron + Vault pattern:** `SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = '...'))` — safe secret injection for scheduled Edge Functions
- **Service-role system functions:** Validate `Bearer === SUPABASE_SERVICE_ROLE_KEY` directly — no user JWT needed for pg_cron-invoked functions; return `{ processed, failed }` shape
- **Idempotent reward processing:** Status-guard UPDATE (`UPDATE ... WHERE status='pending' RETURNING id`) — retry-safe without read-then-write
- **RPC ownership validation:** `WHERE trainer_id = auth.uid()` or admin role check inside Postgres functions — never rely on RLS alone for multi-tenant analytics

### Key Lessons

1. **Ship the cash-flow layer before the metrics layer.** Analytics without real payout data would have been misleading. The forced ordering (payouts → analytics → referrals) was architecturally correct.
2. **Email failures should never block writes.** Consistent `try { await email() } catch {}` wrapper means the user operation always succeeds even when Resend is down or unconfigured.
3. **Referral attribution cookies need `SameSite=Lax`.** OAuth returns via cross-origin redirects — `Strict` silently drops the cookie and attribution is lost. Document this on first use.
4. **pg_cron Vault setup is a manual post-deploy step.** No amount of migration automation can insert real secrets. Document the 3 manual steps (Vault, Stripe webhook enable, Resend key) prominently in the phase summary.
5. **Mock IDs in dev must match prod schema types.** UUID columns reject non-UUID values. Either use real UUIDs in mock data or add type guards at the query layer (`isMockTrainer` pattern).

### Cost Observations

- Model mix: ~100% sonnet (balanced profile)
- Sessions: ~4 sessions across 2 days
- Notable: 11 plans executed with zero plan deviations — well-specified plans minimized executor rework

---

## Milestone: v2.1 — Subscription Tiers

**Shipped:** 2026-03-17
**Phases:** 5 (12–16) | **Plans:** 15 | **Timeline:** 2 days (2026-03-15 → 2026-03-17)
**Files:** ~15,239 LOC at ship · 13 Edge Functions · 18 migrations

### What Was Built

- **Subscription foundation:** 10-column schema migration on `trainer_profiles`, write-guard trigger (`guard_subscription_tier_write`), `get_visible_slots` RPC with tier-based slot limits, Stripe Dashboard config (2 Products, 4 Prices, Customer Portal)
- **Billing backend:** `create-subscription` (PRICE_MAP lookup), `stripe-billing-webhook` (idempotent event processing, tier sync), `manage-subscription` (Customer Portal URL), trial-end email via Resend, `get_admin_analytics` extended with MRR
- **Feature gates:** `tierGates.ts` constant, `useTier`/`useCan` hooks, bio length trigger, slot visibility RPC, analytics tab gating, `LockedFeatureBanner` upgrade CTA
- **Search ranking:** Tier-weighted ranking (elite=1.0, pro=0.67, free=0.0), `FeaturedTrainers` Elite section on landing page, self-hiding empty state
- **Subscription UI:** Public `/pricing` page with billing toggle, `PlanCard` 5-state CTA, trial countdown banner (7-day threshold), `SubscriptionTab` in trainer dashboard, `DowngradeModal` with feature-loss preview
- **Admin visibility:** Tier badges per trainer (7-state color logic), manual tier override via `admin-set-tier-override` Edge Function (service_role bypass), MRR + subscriber + trial count analytics cards

### What Worked

- **Wave-based parallel execution with file-conflict detection:** Plan-checker caught the App.tsx parallel write conflict between 15-02 and 15-03 before execution — promoted 15-03 to Wave 3 with `depends_on: [15-01, 15-02]`. Same pattern applied proactively to AdminDashboard.tsx in Phase 16.
- **Single-writer webhook pattern:** Only `stripe-billing-webhook` writes `subscription_tier` — `create-subscription` deliberately does NOT write, avoiding race conditions with `customer.subscription.created` events that fire within milliseconds.
- **PRICE_MAP in backend, not frontend:** Frontend sends `{tier, interval}` instead of `priceId`. No `VITE_STRIPE_PRICE_*` env vars needed, single source of truth in Edge Function, and code works unchanged across Stripe test/live environments.
- **Progressive disclosure in UI:** Analytics tab label visible for all tiers (discovery UX), but content gated behind `canAnalytics`. LockedFeatureBanner shows what's behind the gate before upgrade. TrialBanner appears only when ≤7 days remain.
- **Vitest introduction in Phase 14:** First automated tests in the codebase — `tierGates.test.ts`, `useTier.test.ts`, `useCan.test.ts`. Provided immediate regression safety for the hooks that gate every feature.

### What Was Inefficient

- **TypeScript type gaps:** Supabase generated types don't include RPC functions or cross-table joins. The codebase has accumulated multiple `as unknown as X` casts and `any` annotations for `get_admin_analytics`, `get_visible_slots`, etc. This tech debt compounds with each phase.
- **Summary format still lacks `one_liner` field:** Same issue as v2.0 — `gsd-tools summary-extract` couldn't pull accomplishments automatically. Milestones.md had to be manually populated. Need to standardize summary format or fix the extraction.
- **Demo data added post-milestone:** Admin dashboard needed demo data fallback for empty databases (demo/investor presentations). This was added as an ad-hoc request rather than being part of the phase plan. Could be anticipated as a standard pattern for dashboards.

### Patterns Established

- **Write-guard trigger + service_role bypass:** `guard_subscription_tier_write` prevents auth-role writes to subscription columns. Webhook and admin-override Edge Functions use service_role to bypass. This is the canonical pattern for "only system processes can modify this column."
- **callEdgeFunction<T> generic helper:** Module-private fetch wrapper with AbortController timeout (10s), JWT retrieval, and typed response parsing. Public API exports typed wrappers (`startTrial`, `getPortalUrl`, `setAdminTierOverride`).
- **Tier-aware component patterns:** `useCan('feature')` for access control, `useTier()` for display logic, `TierBadge` for badge rendering, `TIER_GATES` constant as single source of truth for all gate decisions.
- **TrialBanner null-return pattern:** Returns null when `!trainerProfile` (prevents flash), when `status !== 'trialing'`, when `daysLeft > 7`. Self-contained — no external loading state needed.
- **Inline selector for admin actions:** Override UI uses inline `free/pro/elite` buttons with dismiss (`x`) rather than a modal. Faster admin workflow, less UI overhead.

### Key Lessons

1. **Webhook is the single source of truth for billing state.** Never write subscription_tier from a user-facing Edge Function — the webhook fires within milliseconds and will race with your write. Let the webhook be the only writer.
2. **Serialize file modifications across parallel waves.** If two plans modify the same file in the same wave, the second agent overwrites the first's changes. Always check for file conflicts during plan-checking and promote to a later wave.
3. **Bio triggers should use IS DISTINCT FROM, not simple inequality.** Existing long bios must survive tier downgrades — the trigger only fires when the bio content actually changes, not when any column on the row changes.
4. **Demo data should be a planned pattern, not an afterthought.** Any admin/analytics dashboard should include a `DEMO_*` constant set and `usingDemoData` state from the start. Investors and demos need populated screens before real data exists.
5. **Vitest pays for itself immediately.** Even the minimal test coverage from Phase 14 (3 test files) caught a broken import path during Phase 15 refactoring. The 5-second feedback loop is worth the ~30 minutes of setup.

### Cost Observations

- Model mix: ~80% sonnet, ~20% opus (plan-checker and milestone completion)
- Sessions: ~6 sessions across 2 days
- Notable: 15 plans executed across 5 phases with 1 plan deviation (wave promotion for App.tsx conflict). Plan-checker verification loop caught the issue before execution — zero rework.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 shipped (8 total) | ~12 | Initial build — feature-first, security deferred |
| v2.0 | 3 | 11 | Monetization sprint — phased dependency ordering, DB-first |
| v2.1 | 5 | 15 | Subscription system — wave-based parallelism, plan-checker verification, first automated tests |

### Cumulative Quality

| Milestone | Tests | Edge Functions | Migrations | LOC |
|-----------|-------|----------------|------------|-----|
| v1.0 | 0 | 4 | 9 | ~5,000 |
| v2.0 | 0 | 10 | 14 | ~8,942 |
| v2.1 | 3 files | 13 | 18 | ~15,239 |

### Top Lessons (Verified Across Milestones)

1. **Defer to later, but track the debt.** Both v1.0 (Phases 1–4) and v2.0 (security patches) deferred work that created compounding friction. Always log deferred items in PROJECT.md Active/Deferred so they don't disappear.
2. **Consistent non-blocking patterns across all async operations.** Email, notifications, and referral reward processing all follow the same try/catch wrapper — learned in v1.0 notifications, formalized in v2.0 payout emails.
3. **Single-writer patterns prevent race conditions.** Established in v2.1 — webhook is the only writer for billing state. Same principle applies to any system where multiple actors could modify the same row concurrently.
4. **Plan-checker catches file conflicts that humans miss.** Wave-based parallel execution requires explicit file-conflict detection. The App.tsx conflict in Phase 15 would have caused silent data loss without the checker.
