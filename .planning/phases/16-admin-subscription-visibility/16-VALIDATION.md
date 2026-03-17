---
phase: 16
slug: admin-subscription-visibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + @testing-library/react 16.3.x |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run` — full suite green
- **Phase gate:** All 3 success criteria passing before `/gsd:verify-work`

---

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Command / Method | Infrastructure Exists? |
|--------|----------|-----------|-----------------|----------------------|
| ADMN-01 | Tier badge shows correct label (Free/Pro/Elite/Trialing/Past Due) for each trainer | Unit | `npx vitest run --reporter=verbose` | Vitest configured (Phase 14) |
| ADMN-02 | admin-set-tier-override Edge Function: admin succeeds, non-admin gets 403 | Integration (manual) | Deploy + curl test | Edge Function created in 16-03 |
| ADMN-03 | Analytics tab displays MRR + 3 subscriber counts from updated RPC | Unit | `npx vitest run --reporter=verbose` | Vitest configured |

---

## Wave 0 Gaps (files that must exist before validation can run)

- [ ] `supabase/migrations/20260317100000_admin_trial_count.sql` — covers ADMN-03 (active_trial_count)
- [ ] `supabase/functions/admin-set-tier-override/index.ts` — covers ADMN-02
- [ ] `src/pages/AdminDashboard.tsx` (modified) — covers ADMN-01, ADMN-03

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| admin-set-tier-override blocks non-admin callers | ADMN-02 | Edge Function requires deployed Supabase | Deploy function, call with non-admin JWT, verify 403 response |
| Override sets tier_overridden_by and tier_overridden_at | ADMN-02 | Requires live DB | Call function, check trainer_profiles row in DB |
