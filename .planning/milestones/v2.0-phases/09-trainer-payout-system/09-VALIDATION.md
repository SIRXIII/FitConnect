---
phase: 9
slug: trainer-payout-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if added) or manual verification via preview + Supabase |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npm run build` (type-check + bundle) |
| **Full suite command** | `npm run build && npx supabase functions serve` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run full build + verify Edge Functions compile
- **Before `/gsd:verify-work`:** Full build must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | PAYOUT-04 | build | `npm run build` | N/A | ⬜ pending |
| 09-01-02 | 01 | 1 | PAYOUT-01 | manual | preview snapshot | N/A | ⬜ pending |
| 09-01-03 | 01 | 1 | PAYOUT-05 | manual | preview snapshot | N/A | ⬜ pending |
| 09-01-04 | 01 | 1 | PAYOUT-02 | manual | preview interaction | N/A | ⬜ pending |
| 09-02-01 | 02 | 2 | PAYOUT-02 | build | Edge Function compile | N/A | ⬜ pending |
| 09-02-02 | 02 | 2 | PAYOUT-03 | build | Migration + pg_cron SQL | N/A | ⬜ pending |
| 09-02-03 | 02 | 2 | PAYOUT-06 | build | Edge Function compile | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. No test framework needed — this phase is primarily UI + Edge Functions + DB migrations verified by build + manual preview.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Available balance displays correctly | PAYOUT-01 | Requires seeded booking data | Create completed bookings, verify balance matches SUM of trainer_payout |
| On-demand payout triggers Stripe transfer | PAYOUT-02 | Stripe API call | Click Request Payout, verify Stripe dashboard shows transfer |
| Weekly auto-payout fires | PAYOUT-03 | pg_cron scheduled job | Manually trigger cron job SQL, verify transfers created |
| Transaction history shows entries | PAYOUT-05 | UI rendering | After payout, verify row appears with correct date/amount/status |
| Payout emails send | PAYOUT-06 | Resend API | Trigger payout, check Resend dashboard for sent emails |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
