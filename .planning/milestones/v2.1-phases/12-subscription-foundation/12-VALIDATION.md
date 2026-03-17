---
phase: 12
slug: subscription-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Supabase CLI SQL execution + manual psql verification |
| **Config file** | `Cenlar demand gt 1-17/supabase/migrations/` |
| **Quick run command** | `supabase db diff --local` |
| **Full suite command** | `supabase db reset --local && supabase db diff --local` |
| **Estimated runtime** | ~10 seconds (migration apply) |

Phase 12 is pure infrastructure (SQL migrations + Stripe Dashboard config). Verification is SQL query execution against the live DB, not a test suite.

---

## Sampling Rate

- **After each migration apply:** Run the verification SQL queries listed in Per-Task map
- **After Stripe Dashboard steps:** Screenshot/confirm Products, Prices, webhook endpoint visible
- **Before `/gsd:verify-work`:** All 5 success criteria must be confirmed TRUE
- **Max feedback latency:** ~30 seconds (apply migration → run verification query)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 12-01-01 | 01 | 1 | Infrastructure | SQL query | `SELECT column_name FROM information_schema.columns WHERE table_name = 'trainer_profiles' AND column_name IN ('subscription_tier','stripe_customer_id','trial_ends_at');` | ⬜ pending |
| 12-01-02 | 01 | 1 | Infrastructure | SQL query | `UPDATE trainer_profiles SET subscription_tier = 'pro' WHERE id = '<test_id>';` (must be rejected for auth role) | ⬜ pending |
| 12-01-03 | 01 | 1 | Infrastructure | SQL query | `SELECT get_visible_slots('<free_trainer_id>');` — expect ≤3 rows | ⬜ pending |
| 12-01-04 | 01 | 1 | Infrastructure | SQL query | `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'subscription_events' AND constraint_type = 'UNIQUE';` | ⬜ pending |
| 12-02-01 | 02 | 2 | Infrastructure | Manual | Stripe Dashboard: confirm 2 Products, 4 Prices visible | ⬜ pending |
| 12-02-02 | 02 | 2 | Infrastructure | Manual | Stripe Dashboard: confirm billing webhook endpoint registered with `whsec_*` secret | ⬜ pending |
| 12-02-03 | 02 | 2 | Infrastructure | Manual | Supabase Dashboard: confirm 5 secrets set (STRIPE_PRICE_PRO_MONTHLY, etc.) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — Phase 12 is pure SQL migrations and Stripe Dashboard configuration. No test framework installation needed. Existing Supabase CLI covers migration verification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Products + Prices exist | BILL-01–04 foundation | Stripe Dashboard has no CLI-queryable state locally | Log into Stripe Dashboard → Products → verify Pro + Elite with 4 prices |
| Customer Portal configured | BILL-05 foundation | Portal config is Dashboard-only | Stripe Dashboard → Billing → Customer Portal → verify upgrade/downgrade/cancel enabled |
| Billing webhook endpoint registered | BILL-06 foundation | Webhook endpoint creation is Dashboard step | Stripe Dashboard → Webhooks → verify billing endpoint with `invoice.*` + `customer.subscription.*` events |
| Stripe dunning terminal action = cancel | BILL-07 foundation | Revenue recovery setting is Dashboard-only | Stripe Dashboard → Billing → Revenue recovery → Retries → verify terminal action = Cancel |
| Supabase secrets set | All BILL phases | Secrets are set via Supabase Dashboard or CLI interactively | Supabase Dashboard → Edge Functions → Secrets → verify 5 new secrets present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are documented as Manual-Only
- [ ] Sampling continuity: SQL verification after each migration task
- [ ] Wave 0: N/A — no test framework needed
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for SQL verifications
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
