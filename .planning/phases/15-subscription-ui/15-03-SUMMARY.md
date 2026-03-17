---
phase: 15-subscription-ui
plan: 03
subsystem: ui
tags: [react, subscription, trial-banner, downgrade-modal, stripe-portal, dashboard-tab]

requires:
  - phase: 15-subscription-ui
    provides: getPortalUrl, featuresLostOnDowngrade from subscription.ts (plan 01)
  - phase: 15-subscription-ui
    provides: /pricing route and PricingTable components (plan 02)
  - phase: 14-feature-gates
    provides: Tier type, TierFeature type, TIER_GATES constant, useTier hook, useCan hook
provides:
  - TrialBanner persistent countdown on all pages for trialing trainers
  - SubscriptionTab in TrainerDashboard with tier badge and Stripe Portal redirect
  - DowngradeModal with dynamic feature loss computation from TIER_GATES
  - ?tab=subscription query param support for Stripe Portal return flow
affects: [16-admin-subscription]

tech-stack:
  added: []
  patterns: [persistent banner via conditional render in App.tsx layout, tab query param initialization from URL search params]

key-files:
  created:
    - Cenlar demand gt 1-17/src/components/subscription/TrialBanner.tsx
    - Cenlar demand gt 1-17/src/components/subscription/SubscriptionTab.tsx
    - Cenlar demand gt 1-17/src/components/subscription/DowngradeModal.tsx
  modified:
    - Cenlar demand gt 1-17/src/App.tsx
    - Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx

key-decisions:
  - "TrialBanner handles own null checks internally -- no loading selector from auth store needed"
  - "DowngradeModal confirm redirects to Stripe Portal rather than calling a cancel API directly"
  - "Tab initialization reads ?tab= query param so Stripe Portal return auto-selects subscription tab"

patterns-established:
  - "Persistent banner pattern: conditional render between Navbar and Routes in App.tsx"
  - "Tab query param initialization: useState lazy initializer reads searchParams.get('tab')"

requirements-completed: [BILL-02, BILL-03, BILL-05]

duration: 3min
completed: 2026-03-17
---

# Phase 15 Plan 03: Trial Banner + Subscription Tab Summary

**Persistent trial countdown banner on all pages, dashboard subscription management tab with Stripe Portal redirect, and downgrade confirmation modal with dynamic feature loss from TIER_GATES**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T03:11:26Z
- **Completed:** 2026-03-17T03:14:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- TrialBanner renders between Navbar and Routes for all trainer pages, shows countdown when trial <= 7 days, hidden otherwise
- SubscriptionTab shows tier badge with trialing/active/free states, Manage Subscription button redirecting to Stripe Portal, and Downgrade to Free button
- DowngradeModal dynamically computes lost features via featuresLostOnDowngrade(currentTier, 'free') using TIER_GATES
- TrainerDashboard now has 4 tabs with ?tab=subscription query param support for Stripe Portal return flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TrialBanner and add to App.tsx layout** - `5d1b397` (feat)
2. **Task 2: Create SubscriptionTab with DowngradeModal and wire into TrainerDashboard** - `2f36785` (feat)

## Files Created/Modified
- `Cenlar demand gt 1-17/src/components/subscription/TrialBanner.tsx` - Persistent trial countdown banner with 7-day threshold and singular/plural day handling
- `Cenlar demand gt 1-17/src/components/subscription/SubscriptionTab.tsx` - Dashboard tab with tier badge, Stripe Portal redirect, and downgrade CTA
- `Cenlar demand gt 1-17/src/components/subscription/DowngradeModal.tsx` - Confirmation modal with dynamic feature loss list from TIER_GATES
- `Cenlar demand gt 1-17/src/App.tsx` - Added TrialBanner import and conditional render for trainer role
- `Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx` - Added subscription tab, SubscriptionTab import, and ?tab= query param initialization

## Decisions Made
- TrialBanner handles its own null checks internally rather than relying on a loading selector from auth store -- prevents flash on first render
- DowngradeModal confirm action redirects to Stripe Portal (where actual cancellation happens) rather than calling a cancel API -- keeps billing state management in Stripe
- Tab initialization reads ?tab= query param via lazy useState initializer so returning from Stripe Portal auto-selects the subscription tab

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 15 (Subscription UI) is now complete -- all 3 plans delivered
- Phase 16 (Admin Subscription) can proceed with admin-side subscription management
- All BILL requirements covered by Phase 15 are delivered: trial banner (BILL-02), subscription tab (BILL-03), downgrade flow (BILL-05)

---
*Phase: 15-subscription-ui*
*Completed: 2026-03-17*
