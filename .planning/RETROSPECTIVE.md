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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 shipped (8 total) | ~12 | Initial build — feature-first, security deferred |
| v2.0 | 3 | 11 | Monetization sprint — phased dependency ordering, DB-first |

### Cumulative Quality

| Milestone | Tests | Edge Functions | Migrations |
|-----------|-------|----------------|------------|
| v1.0 | 0 | 4 | 9 |
| v2.0 | 0 | 10 | 14 |

### Top Lessons (Verified Across Milestones)

1. **Defer to later, but track the debt.** Both v1.0 (Phases 1–4) and v2.0 (security patches) deferred work that created compounding friction. Always log deferred items in PROJECT.md Active/Deferred so they don't disappear.
2. **Consistent non-blocking patterns across all async operations.** Email, notifications, and referral reward processing all follow the same try/catch wrapper — learned in v1.0 notifications, formalized in v2.0 payout emails.
