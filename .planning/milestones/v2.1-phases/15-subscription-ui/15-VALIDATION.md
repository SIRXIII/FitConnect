---
phase: 15
slug: subscription-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 15 — Validation Strategy

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
- **Phase gate:** All 5 success criteria passing before `/gsd:verify-work`

---

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Command / Method | Infrastructure Exists? |
|--------|----------|-----------|-----------------|----------------------|
| BILL-01 | `startTrial` calls `create-subscription` with tier+interval | Unit | `npx vitest run src/lib/subscription.test.ts` | Vitest configured (Phase 14) |
| BILL-02 | TrialBanner shows when <= 7 days remain, hidden when > 7 | Unit | `npx vitest run src/components/subscription/TrialBanner.test.tsx` | Vitest configured |
| BILL-03 | "Manage Subscription" calls manage-subscription, redirects | Unit | `npx vitest run src/components/subscription/SubscriptionTab.test.tsx` | Vitest configured |
| BILL-04 | BillingToggle switches prices, shows "Save 20%" | Unit | `npx vitest run src/components/subscription/BillingToggle.test.tsx` | Vitest configured |
| BILL-05 | DowngradeModal lists correct features lost per tier | Unit | `npx vitest run src/components/subscription/DowngradeModal.test.tsx` | Vitest configured |

---

## Wave 0 Gaps (files that must exist before validation can run)

- [ ] `src/lib/subscription.ts` — covers BILL-01, BILL-03
- [ ] `src/lib/subscription.test.ts` — covers BILL-01
- [ ] `src/components/subscription/TrialBanner.tsx` — covers BILL-02
- [ ] `src/components/subscription/TrialBanner.test.tsx` — covers BILL-02
- [ ] `src/components/subscription/SubscriptionTab.tsx` — covers BILL-03, BILL-05
- [ ] `src/components/subscription/DowngradeModal.tsx` — covers BILL-05
- [ ] `src/pages/Pricing.tsx` — covers BILL-01, BILL-04
- [ ] `src/components/subscription/BillingToggle.tsx` — covers BILL-04
