---
phase: 09-trainer-payout-system
verified: 2026-03-14T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Payouts tab visual and balance display"
    expected: "Available balance shows as large hero number (text-5xl serif). Pending balance shows smaller below with tooltip. Both update in real-time when new payments arrive."
    why_human: "CSS class rendering and visual hierarchy cannot be verified programmatically."
  - test: "Request Payout button disabled state with tooltip"
    expected: "When available balance < $50 the button is greyed out with opacity-50 and hovering shows the tooltip 'Minimum $50 required'."
    why_human: "Tooltip display and disabled-state appearance require a live browser."
  - test: "Confirmation modal copy and flow"
    expected: "Clicking Request Payout (when balance >= $50) opens a modal that reads 'Request payout of $X.XX? Funds arrive within 2 business days.' Confirm triggers POST to create-payout. Cancel closes the modal without action."
    why_human: "Modal interaction and exact copy rendering require a live browser session."
  - test: "Transaction history table — combined and sorted"
    expected: "Table shows both payment credit rows (client name) and payout transfer rows (labelled 'Payout Transfer' with negative amount). Combined list sorted newest-first. Empty state shows 'No transactions yet.' when no data."
    why_human: "Combined sort order and visual differentiation of row types require a live browser with data."
  - test: "Overview tab regression"
    expected: "Clicking Overview tab shows all original dashboard content (Stats, Rates, Discount Slider, Stripe Connect, Availability) unchanged. Payouts tab content is not visible when on Overview."
    why_human: "Tab switching and regression of existing content requires live browser verification."
  - test: "Payout email delivery end-to-end"
    expected: "After a payout is initiated, the trainer receives an email with subject 'Your FitRush payout has been initiated'. After payout.paid webhook fires, a second email arrives with subject 'Your FitRush payout has arrived'."
    why_human: "Email delivery requires RESEND_API_KEY to be set in production and actual Stripe webhook events — cannot be verified from source alone."
  - test: "Weekly auto-payout via pg_cron"
    expected: "On Monday at 09:00 UTC, the pg_cron job fires and calls the weekly-payouts Edge Function, which processes all trainers with balance >= $50 and creates Stripe transfers."
    why_human: "pg_cron requires Vault secrets to be set manually and cannot be triggered from code inspection. Requires production environment or manual SQL execution."
---

# Phase 9: Trainer Payout System Verification Report

**Phase Goal:** Enable trainers to withdraw earnings via Stripe Connect.
**Verified:** 2026-03-14
**Status:** human_needed — all automated checks pass; 7 items need live environment verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Trainer's on-demand payout request results in a Stripe transfer and an initiation email | VERIFIED | `create-payout/index.ts` line 195: `stripe.transfers.create(...)`, lines 246-258: Resend fetch call for initiation email |
| 2 | Payout request with balance < $50 is rejected with clear error message | VERIFIED | `create-payout/index.ts` lines 105-113: `if (balance < 50) return 400 "Minimum payout amount is $50"` |
| 3 | send-notification-email sends real emails via Resend API | VERIFIED | `send-notification-email/index.ts` lines 81-99: fetch to `https://api.resend.com/emails` with RESEND_API_KEY bearer token |
| 4 | Trainer sees Overview and Payouts tabs, defaulting to Overview | VERIFIED | `TrainerDashboard.tsx` line 16: `useState<'overview' \| 'payouts'>('overview')`, lines 131-145: tab bar render |
| 5 | Trainer sees available balance and pending balance on Payouts tab | VERIFIED | `PayoutsTab.tsx` lines 103-113: client-side reduce on `trainer_payout`, lines 265-282: hero balance render |
| 6 | Request Payout button is disabled with tooltip when balance < $50 | VERIFIED | `PayoutsTab.tsx` line 229: `const canRequestPayout = availableBalance >= 50`, lines 286-300: `disabled={!canRequestPayout}` + `title="Minimum $50 required"` |
| 7 | Clicking Request Payout opens confirmation modal with exact amount | VERIFIED | `PayoutsTab.tsx` lines 341-373: modal renders `{formatUSD(availableBalance)}` with modal copy "Request payout of ... Funds arrive within 2 business days." |
| 8 | Weekly auto-payout fires every Monday at 09:00 UTC for trainers with balance >= $50 | VERIFIED | `20260314210000_weekly_payout_cron.sql` line 29: `'0 9 * * 1'`, `weekly-payouts/index.ts` lines 71-73: balance >= 50 filter |
| 9 | payout.paid webhook triggers completion email to trainer | VERIFIED | `stripe-webhook/index.ts` lines 133-231: `case 'payout.paid'` handler with Resend email call subject "Your FitRush payout has arrived" |
| 10 | Transaction history shows combined payments and payout transfers sorted newest-first | VERIFIED | `PayoutsTab.tsx` lines 130-160: builds paymentTxRows + payoutTxRows, lines 158-160: combined sort by `created_at DESC` |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `supabase/migrations/20260314200000_payout_system.sql` | payout_transactions table, payments FK, indexes, RLS | VERIFIED | 68 lines; CREATE TABLE, ALTER TABLE, 2 CREATE INDEX, ENABLE ROW LEVEL SECURITY, 3 RLS policies — all present |
| `supabase/functions/create-payout/index.ts` | On-demand payout Edge Function, 80+ lines | VERIFIED | 290 lines; Deno.serve, JWT auth, balance calc, $50 guard, duplicate guard, Stripe transfer, rollback path, email |
| `supabase/functions/send-notification-email/index.ts` | Resend-integrated email sending | VERIFIED | 119 lines; `api.resend.com/emails` fetch call present, dev-mode fallback to console.log, backward-compatible interface |
| `src/pages/TrainerDashboard.tsx` | Tab switcher (Overview / Payouts) with activeTab state | VERIFIED | Contains `activeTab` state, tab bar, `{activeTab === 'overview' && ...}` guard, `{activeTab === 'payouts' && <PayoutsTab />}` |
| `src/components/trainer/PayoutsTab.tsx` | Balance display, transaction table, payout request flow | VERIFIED | 379 lines; hero balance, pending balance, $50 guard, modal, transaction table, realtime subscription, loading skeleton |
| `supabase/functions/weekly-payouts/index.ts` | Auto-payout Edge Function, 60+ lines | VERIFIED | 279 lines; service-role auth, eligible trainer aggregation, per-trainer Stripe transfer loop, rollback on failure, initiation email |
| `supabase/migrations/20260314210000_weekly_payout_cron.sql` | pg_cron schedule, Vault secret setup | VERIFIED | `cron.schedule` with `'0 9 * * 1'`, `net.http_post` with Vault-backed URL and Authorization header |
| `supabase/functions/stripe-webhook/index.ts` | payout.paid handler for completion email | VERIFIED | `case 'payout.paid'` present with trainer lookup, concurrent-payout guard, status update to 'completed', Resend email |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `create-payout/index.ts` | `stripe.transfers.create` | Stripe SDK call | WIRED | Line 195: `transfer = await stripe.transfers.create({...destination: stripeAccountId...})` |
| `create-payout/index.ts` | `payout_transactions` | INSERT pending, UPDATE to processing | WIRED | Lines 141-148 (INSERT), line 232-233 (UPDATE to processing), lines 215-221 (rollback on failure) |
| `send-notification-email/index.ts` | Resend API | fetch POST to api.resend.com/emails | WIRED | Lines 81-99: fetch with Bearer token, request body, error handling |
| `PayoutsTab.tsx` | `payments` table (balance) | client-side SUM of trainer_payout | WIRED | Lines 86-106: `.select('...trainer_payout')`, `.in('booking_id', bookingIds)`, client-side reduce |
| `PayoutsTab.tsx` | `create-payout` Edge Function | fetch POST to `/functions/v1/create-payout` | WIRED | Lines 203-208: `fetch(\`${SUPABASE_URL}/functions/v1/create-payout\`, {method: 'POST', headers: {Authorization: Bearer token}})` |
| `TrainerDashboard.tsx` | `PayoutsTab.tsx` | Tab state conditional render | WIRED | Line 282: `{activeTab === 'payouts' && <PayoutsTab />}`, line 9: `import PayoutsTab from '@/components/trainer/PayoutsTab'` |
| `pg_cron job` | `weekly-payouts` Edge Function | `net.http_post` with Vault credentials | WIRED | Migration lines 31-38: `net.http_post(url := (SELECT decrypted_secret...) || '/functions/v1/weekly-payouts', headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret...)))` |
| `weekly-payouts/index.ts` | `stripe.transfers.create` | Loop over eligible trainers | WIRED | Lines 188-197: `transfer = await stripe.transfers.create({...initiated_by: 'auto'...})` |
| `stripe-webhook/index.ts payout.paid` | `payout_transactions` via status update | Update to 'completed' matching trainer | WIRED | Lines 192-195: `.update({status: 'completed'}).eq('id', payoutTx.id)` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PAYOUT-01 | 09-02 | Trainer sees available balance + pending balance on payout dashboard | SATISFIED | `PayoutsTab.tsx`: two balance cards with client-side aggregation of `trainer_payout` from payments table |
| PAYOUT-02 | 09-01, 09-02 | Trainer can initiate on-demand payout when balance >= $50 | SATISFIED | `create-payout/index.ts`: $50 guard + Stripe transfer; `PayoutsTab.tsx`: disabled button + modal + fetch call to Edge Function |
| PAYOUT-03 | 09-03 | Platform auto-initiates weekly payout every Monday for trainers with balance >= $50 | SATISFIED | `weekly-payouts/index.ts`: iterates eligible trainers; pg_cron migration: `'0 9 * * 1'` schedule |
| PAYOUT-04 | 09-01, 09-02 | Balance = completed bookings sum minus 8% platform fee minus Stripe fees | SATISFIED (with note) | `trainer_payout` column is set by `create-payment-intent` upstream (which receives the pre-computed value from the bookings table). Both `create-payout` and `PayoutsTab` read this column directly without recomputing fees, which is correct per plan design. The fee calculation is owned by the booking/payment creation flow, not the payout phase. |
| PAYOUT-05 | 09-02 | Transaction history shows date, amount, status per transfer | SATISFIED | `PayoutsTab.tsx` lines 304-338: table with Date / Client / Amount / Status columns; combined payments + payout_transactions rows sorted newest-first |
| PAYOUT-06 | 09-01, 09-03 | Trainer receives email when payout is initiated and when it completes | SATISFIED | Initiation: `create-payout/index.ts` lines 235-268 (Resend POST) and `weekly-payouts/index.ts` lines 228-261. Completion: `stripe-webhook/index.ts` lines 206-226 in `payout.paid` case |

**All 6 requirements satisfied. No orphaned requirements.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned all 7 implementation files. No TODO/FIXME/placeholder comments, no empty return stubs, no console.log-only implementations, no return null/return [] stubs.

---

## Notable Design Notes (Non-Blocking)

**PAYOUT-04 — fee calculation ownership:** REQUIREMENTS.md defines PAYOUT-04 as "Balance calculated as: completed bookings sum − 8% platform fee − Stripe fees". The payout phase does NOT recompute fees inline; instead it reads `payments.trainer_payout` which is written by `create-payment-intent` (an earlier phase). This is explicitly correct per Plan 01 and Plan 02 specs ("do NOT recompute fees"). The `platform_settings` migration confirms 8% fee is defined system-wide. This satisfies the requirement semantically — the balance shown IS the post-fee amount.

**send-notification-email auth mismatch:** The `send-notification-email` function authenticates callers via user JWT (`userClient.auth.getUser()`). However, `create-payout` and `weekly-payouts` call Resend directly (not through `send-notification-email`). The Edge Function is only called by user-initiated paths. This is consistent with the plan ("use Resend directly — simpler") and is not a defect, but means `send-notification-email` is currently only callable by authenticated users, not system functions.

---

## Human Verification Required

### 1. Payouts Tab Visual Rendering

**Test:** Log in as a trainer with a Stripe-connected account. Navigate to `/trainer/dashboard`. Click the "Payouts" tab.
**Expected:** Available balance renders as a large serif hero number (text-5xl). Pending balance renders smaller below it. Both cards match the existing stat-card border pattern from the Overview tab.
**Why human:** CSS class rendering and visual hierarchy require a live browser.

### 2. Request Payout Disabled State and Tooltip

**Test:** With available balance < $50, observe the Request Payout button.
**Expected:** Button appears greyed out with opacity-50. Hovering over it shows tooltip "Minimum $50 required". A text hint below the button reads "Minimum $50.00 balance required to request a payout."
**Why human:** Tooltip and disabled-state appearance require a live browser.

### 3. Confirmation Modal Flow

**Test:** With available balance >= $50, click "Request Payout".
**Expected:** Modal appears with text "Request payout of $X.XX? Funds arrive within 2 business days." Two buttons: Confirm (accent-bordered) and Cancel. Clicking Cancel closes modal without action. Clicking Confirm shows "Processing..." on the button, then on success shows toast "Payout requested successfully" and clears balance to $0.
**Why human:** Modal interaction, exact rendered copy, and success/error toast behaviour require a live browser.

### 4. Transaction History Table

**Test:** With some completed bookings and at least one payout transaction, view the Payouts tab.
**Expected:** Table shows a combined list sorted newest-first. Payment rows show the client's name. Payout transfer rows show "Payout Transfer" in italic and a negative amount (e.g., −$150.00). Status badges: green for succeeded/completed, amber for pending/processing, red for failed. Empty state "No transactions yet." when no data.
**Why human:** Combined sort, row differentiation, and badge rendering require live data and a browser.

### 5. Overview Tab Regression

**Test:** On the Trainer Dashboard, click "Payouts" tab then click back to "Overview".
**Expected:** All original dashboard content is visible and unchanged: Stats grid (Upcoming Bookings, Available Slots, Booked Slots, Rating), Rates display, Discount Slider, Stripe Connect section, Availability section. None of these appear on the Payouts tab.
**Why human:** Tab regression requires a live browser session.

### 6. Email Delivery End-to-End

**Test:** With RESEND_API_KEY configured in Supabase Edge Function secrets, initiate an on-demand payout.
**Expected:** Trainer receives email with subject "Your FitRush payout has been initiated" within seconds. After Stripe pays out to the trainer's bank (payout.paid webhook fires), trainer receives email with subject "Your FitRush payout has arrived".
**Why human:** Email delivery requires RESEND_API_KEY secret set in production Supabase and real Stripe webhook events.

### 7. pg_cron Weekly Auto-Payout

**Test:** After deploying the migration and setting Vault secrets (`vault.create_secret` for `project_url` and `service_role_key`), verify the cron job is registered: `SELECT * FROM cron.job WHERE jobname = 'weekly-trainer-payouts';`. On Monday 09:00 UTC (or by manually triggering), confirm the Edge Function is called and processes eligible trainers.
**Expected:** Cron job exists with schedule `0 9 * * 1`. On execution, `weekly-payouts` returns `{ processed: N, failed: 0 }` and new `payout_transactions` rows appear with `initiated_by = 'auto'`.
**Why human:** pg_cron requires Vault secrets set manually and cannot be verified from code alone. Trigger requires either waiting for Monday or manual SQL execution.

---

## Gaps Summary

No automated gaps found. All 10 must-have truths are verified against actual code. All 8 required artifacts exist, are substantive (far above minimum line counts), and are wired to their dependencies. All 9 key links are confirmed present in code. All 6 requirements (PAYOUT-01 through PAYOUT-06) are satisfied.

The phase goal — "Enable trainers to withdraw earnings via Stripe Connect" — is fully implemented in code. Production readiness requires the 7 human verification items above, primarily the external configuration steps (Vault secrets, Stripe webhook Connect events, RESEND_API_KEY) and live browser testing of the UI.

---

_Verified: 2026-03-14_
_Verifier: Claude (gsd-verifier)_
