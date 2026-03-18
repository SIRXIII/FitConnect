---
phase: 19
slug: calendar-export-buffer-times
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + Edge Function curl tests |
| **Config file** | none — no test framework in project |
| **Quick run command** | `cd "Cenlar demand gt 1-17" && npx tsc --noEmit` |
| **Full suite command** | `cd "Cenlar demand gt 1-17" && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must succeed
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | CAL-03 | migration | `supabase db diff` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 2 | CAL-01, CAL-02 | edge-fn | `curl <feed-url>` | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 2 | CAL-04 | trigger | SQL test query | ❌ W0 | ⬜ pending |
| 19-02-03 | 02 | 2 | CAL-05 | rpc | SQL test query | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 3 | CAL-03, CAL-06 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 3 | CAL-01, CAL-02 | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (TypeScript build + manual Edge Function testing)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iCal file opens in Apple/Google Calendar | CAL-01 | Requires external app | Download .ics, open in calendar app |
| Live feed subscribes in Google Calendar | CAL-02 | Requires external service | Add feed URL in Google Calendar settings |
| Buffer enforcement rejects overlapping booking | CAL-04 | Requires live Supabase | Attempt booking within buffer window |
| Slots hidden within buffer window | CAL-05 | Requires live data | Check visible slots near existing booking |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
