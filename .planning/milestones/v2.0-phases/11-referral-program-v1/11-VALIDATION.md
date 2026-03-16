---
phase: 11
slug: referral-program-v1
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if needed) or manual verification via preview + Supabase |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npm run build` (type-check + bundle) |
| **Full suite command** | `npm run build && npx supabase db diff` |
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
| 11-01-01 | 01 | 1 | REFERRAL-01, REFERRAL-02 | build | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | REFERRAL-03, REFERRAL-04 | build | Edge Function compile check | N/A | ⬜ pending |
| 11-02-01 | 02 | 2 | REFERRAL-01 | build | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |
| 11-02-02 | 02 | 2 | REFERRAL-02 | build | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |
| 11-03-01 | 03 | 2 | REFERRAL-05, REFERRAL-06 | build | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. No test framework install needed — this phase is UI + Edge Functions + DB migrations verified by build + manual preview.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Referral code visible on profile | REFERRAL-01 | UI rendering | Log in, open profile, verify unique code + share link |
| New user attributed via cookie | REFERRAL-02 | Multi-step OAuth flow | Visit `/ref/CODE`, sign up via OAuth, check referrals table |
| $10 trainer credit applied | REFERRAL-03 | Requires completed booking + DB check | Trigger completed booking for referred client, verify payout_transactions row |
| $5 client discount at checkout | REFERRAL-04 | Requires booking flow | Referred client books referred trainer, verify discount applied |
| Leaderboard renders | REFERRAL-05 | UI rendering | Open landing page, verify top referrers table |
| Milestone notifications fire | REFERRAL-06 | Requires Resend + in-app | Trigger reward, check sonner toast + Resend dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
