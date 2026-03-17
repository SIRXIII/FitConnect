---
phase: 15-subscription-ui
plan: 01
subsystem: payments
tags: [stripe, subscription, typescript, edge-function, pricing]

requires:
  - phase: 13-billing-backend
    provides: create-subscription and manage-subscription Edge Functions
  - phase: 14-feature-gates
    provides: Tier type, TierFeature type, TIER_GATES constant from tierGates.ts
provides:
  - PRICING_DATA constant with Free/Pro/Elite tier pricing
  - startTrial() and getPortalUrl() Edge Function callers
  - callEdgeFunction<T>() generic authenticated fetch helper
  - featuresLostOnDowngrade() for downgrade modal support
  - BillingInterval and PlanPricing type exports
  - PRICE_MAP server-side lookup in create-subscription
affects: [15-02-PLAN (pricing page), 15-03-PLAN (trial banner + dashboard tab)]

tech-stack:
  added: []
  patterns: [callEdgeFunction generic helper with AbortController timeout, PRICE_MAP env-var resolution in Edge Functions]

key-files:
  created:
    - Cenlar demand gt 1-17/src/lib/subscription.ts
  modified:
    - Cenlar demand gt 1-17/supabase/functions/create-subscription/index.ts

key-decisions:
  - "PRICE_MAP uses env vars not hardcoded Stripe price IDs -- deployment-safe"
  - "callEdgeFunction is module-private, startTrial/getPortalUrl are the public API"
  - "Backward compatibility preserved -- create-subscription still accepts raw priceId"

patterns-established:
  - "callEdgeFunction<T>(fnName, body?) pattern for all Edge Function calls from client"
  - "PRICE_MAP env-var resolution pattern for tier+interval to Stripe priceId mapping"

requirements-completed: [BILL-01, BILL-04]

duration: 5min
completed: 2026-03-17
---

# Phase 15 Plan 01: Subscription Helpers Summary

**Subscription helper library with PRICING_DATA, Edge Function callers, and tier+interval PRICE_MAP in create-subscription**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T03:02:24Z
- **Completed:** 2026-03-17T03:07:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- create-subscription Edge Function now accepts `{ tier, interval }` via PRICE_MAP lookup while remaining backward-compatible with `{ priceId }`
- subscription.ts exports PRICING_DATA with 3 tiers (Free $0, Pro $9/mo, Elite $29/mo) with correct annual savings
- startTrial() and getPortalUrl() provide typed Edge Function callers with auth and timeout
- featuresLostOnDowngrade() computes feature loss for downgrade modals using TIER_GATES

## Task Commits

Each task was committed atomically:

1. **Task 1: Modify create-subscription Edge Function to accept tier+interval** - `2d829b3` (feat)
2. **Task 2: Create subscription helper library** - `d8e13da` (feat)

## Files Created/Modified
- `Cenlar demand gt 1-17/src/lib/subscription.ts` - Subscription helper library with types, pricing data, Edge Function callers, and downgrade utility
- `Cenlar demand gt 1-17/supabase/functions/create-subscription/index.ts` - Added PRICE_MAP lookup for tier+interval resolution

## Decisions Made
- PRICE_MAP reads Stripe price IDs from env vars (not hardcoded) so the same code works across Stripe test/live environments
- callEdgeFunction is not exported -- startTrial and getPortalUrl are the public API surface, keeping the internal fetch mechanism encapsulated
- Backward compatibility preserved: existing priceId callers still work alongside new tier+interval path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in RoleSelect.tsx (referrer_id type mismatch) -- out of scope, not introduced by this plan.

## User Setup Required

None - no external service configuration required. STRIPE_PRICE_* env vars must already be set in Supabase Edge Function secrets (configured in Phase 12).

## Next Phase Readiness
- subscription.ts is ready for import by pricing page (15-02) and trial banner / dashboard tab (15-03)
- All 6 exports match the must_haves specification: PRICING_DATA, PlanPricing, BillingInterval, startTrial, getPortalUrl, featuresLostOnDowngrade

---
*Phase: 15-subscription-ui*
*Completed: 2026-03-17*
