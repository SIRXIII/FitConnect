---
phase: 10
slug: earnings-analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) or manual verification via preview + Supabase |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npm run build` (type-check + bundle) |
| **Full suite command** | `npm run build && npx supabase db diff` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run full build + verify RPC functions compile via Supabase
- **Before `/gsd:verify-work`:** Full build must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | ANALYTICS-01, ANALYTICS-02 | build | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |
| 10-01-02 | 01 | 1 | ANALYTICS-03, ANALYTICS-04 | build | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |
| 10-02-01 | 02 | 2 | ANALYTICS-05 | build | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |
| 10-02-02 | 02 | 2 | ANALYTICS-06 | manual | preview snapshot | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. No test framework install needed — this phase is UI + Postgres RPC functions verified by build + manual preview.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Revenue trend chart renders correctly | ANALYTICS-01 | UI rendering with real data | Seed bookings, open Analytics tab, verify AreaChart displays |
| Gross vs net metrics display correctly | ANALYTICS-02 | Requires seeded payment data | Verify stats cards show correct totals |
| Admin platform analytics render | ANALYTICS-03 | Requires admin role + data | Log in as admin, verify platform dashboard |
| Admin time period filter works | ANALYTICS-04 | UI interaction | Change filter dropdown, verify data updates |
| CSV downloads with correct totals | ANALYTICS-05 | File download verification | Click export, open CSV, verify totals match UI |
| Trainer peak hours heatmap renders | ANALYTICS-06 | Visual grid rendering | Verify CSS grid heatmap displays booking patterns |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
