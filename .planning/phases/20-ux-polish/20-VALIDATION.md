---
phase: 20
slug: ux-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + React Testing Library 16.3.2 |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | UXP-03 | unit | `npx vitest run src/components/shared/Skeleton.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | UXP-04 | unit | `npx vitest run src/components/shared/ErrorState.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | UXP-02 | unit | `npx vitest run src/lib/imageUtils.test.ts -x` | ❌ W0 | ⬜ pending |
| 20-03-01 | 03 | 3 | UXP-01 | unit | `npx vitest run src/components/booking/BookingWizard.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/shared/Skeleton.test.tsx` — stubs for UXP-03
- [ ] `src/components/shared/ErrorState.test.tsx` — stubs for UXP-04
- [ ] `src/lib/imageUtils.test.ts` — stubs for UXP-02
- [ ] `src/components/booking/BookingWizard.test.tsx` — stubs for UXP-01

*Existing infrastructure covers framework — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton shimmer visual appearance | UXP-03 | CSS animation visual fidelity | Slow network → verify pulse animation matches content shape |
| Booking wizard step transitions | UXP-01 | Framer Motion animation timing | Navigate steps → verify smooth slide transitions |
| Lazy loading triggers on scroll | UXP-02 | Requires viewport scroll simulation | Load trainer search → scroll → verify images load on enter viewport |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
