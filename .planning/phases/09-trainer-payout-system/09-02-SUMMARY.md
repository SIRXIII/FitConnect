---
phase: 09-trainer-payout-system
plan: "02"
subsystem: payout-ui
tags: [react, supabase-realtime, stripe, payout-ui, trainer-dashboard]
dependency_graph:
  requires: [payout_transactions-table, create-payout-function]
  provides: [payouts-tab-ui, trainer-payout-ux]
  affects: [TrainerDashboard]
tech_stack:
  added: []
  patterns: [client-side-SUM-aggregation, realtime-subscription, optimistic-update, confirmation-modal]
key_files:
  created:
    - Cenlar demand gt 1-17/src/components/trainer/PayoutsTab.tsx
  modified:
    - Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx
decisions:
  - "Tab switcher defaults to overview — no regressions to existing dashboard content"
  - "Balance uses client-side reduce over payments.trainer_payout rows (no .rpc() needed)"
  - "Payout transfer rows shown as negative amounts (minus sign) to distinguish from payment credits"
  - "Realtime subscription on payments table refreshes balance automatically on new payment events"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 9 Plan 02: Payouts Tab UI Summary

**One-liner:** Trainer payout UI with tab switcher (overview/payouts), hero balance display, $50-gated request payout modal with Stripe Edge Function call, and combined payment+transfer transaction history table with realtime refresh.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TrainerDashboard tabs + PayoutsTab component | 45e16db | TrainerDashboard.tsx, PayoutsTab.tsx |

## Tasks Completed (All)

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 2 | Verify Payouts tab UI | (checkpoint approved) | — |

Human verified and approved the Payouts tab UI on 2026-03-14.

## What Was Built

### Task 1: TrainerDashboard Tab Switcher

- Added `activeTab` state (`'overview' | 'payouts'`, default `'overview'`)
- Added tab bar after Header section using exact AdminDashboard.tsx pattern (border-b-2 border-ink active, text-ink/40 hover inactive)
- Wrapped all existing dashboard content (Stats, Rates, Discount, Stripe Connect, Availability) in `{activeTab === 'overview' && (<>...</>)}`
- Added `{activeTab === 'payouts' && <PayoutsTab />}` after overview block
- Imported PayoutsTab component

### Task 1: PayoutsTab Component (280 lines)

**A. Balance Display:**
- Available balance: `text-5xl serif font-light` hero card using stat card border pattern
- Pending balance: `text-lg serif font-light text-ink/60` with `title` tooltip and subtext explanation
- Both use client-side reduce over `payments.trainer_payout` rows (no RPC)
  - Available: filter `status === 'succeeded' && !payout_transaction_id`
  - Pending: filter `status === 'pending' || status === 'processing'`

**B. Request Payout Button:**
- Disabled with `title="Minimum $50 required"` and `opacity-50 cursor-not-allowed` when balance < $50
- On click: opens confirmation modal with exact formatted amount
- Modal copy: "Request payout of $X.XX? Funds arrive within 2 business days."
- On confirm: POST to `/functions/v1/create-payout` with Bearer token
- On success: `toast.success`, close modal, optimistic balance clear to $0, refetch
- On error: `toast.error('Payout failed. Please try again or contact support.')`, close modal, balance unchanged

**C. Transaction History Table:**
- Fetches `payments` rows (with client name via `bookings` join to `profiles`)
- Fetches `payout_transactions` rows (shown as "Payout Transfer" client, amount shown as negative)
- Combined array sorted by `created_at` DESC (newest-first)
- Columns: Date | Client | Amount | Status
- StatusBadge component: green (succeeded/completed), amber (pending/processing), red (failed)
- Empty state: "No transactions yet."

**D. Loading Skeleton:**
- Pulsing gray bars (`animate-pulse`) while data loads

**E. Realtime:**
- Supabase realtime channel on `payments` table auto-refetches balance+transactions on any change

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor implementation notes (not deviations):

1. The `payments` table `payout_transaction_id` column was added via migration in 09-01 but is not in the generated TS types file. Handled with a typed `as` cast on the select result — a local interface captures the full shape without modifying the generated types file.

2. Payout transfer rows in the transaction table display amount as `−$X.XX` (negative) to visually distinguish outgoing transfers from incoming payment credits. This is additive to the plan spec (which said "Payout Transfer" as client, net payout per row) and consistent with standard finance table conventions.

## Self-Check: PASSED

- FOUND: Cenlar demand gt 1-17/src/components/trainer/PayoutsTab.tsx
- FOUND: Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx (modified)
- FOUND: commit 45e16db
- Build: `npm run build` succeeded with 0 TypeScript errors
