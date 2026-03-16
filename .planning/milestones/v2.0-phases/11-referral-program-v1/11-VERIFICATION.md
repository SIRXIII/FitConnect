---
phase: 11-referral-program-v1
verified: 2026-03-14T00:00:00Z
status: human_needed
score: 16/16 must-haves verified
human_verification:
  - test: "Referral code visible on TrainerDashboard overview tab"
    expected: "8-char code displayed in ReferralWidget with 'Copy Link' button"
    why_human: "UI rendering and tab state cannot be verified programmatically"
  - test: "Copy button fires sonner toast 'Referral link copied!'"
    expected: "Toast appears, button switches to 'Copied!' briefly"
    why_human: "Clipboard API and toast behavior require a browser"
  - test: "Referral code visible on ClientDashboard"
    expected: "ReferralWidget renders below quick-actions grid"
    why_human: "UI rendering requires browser"
  - test: "Landing ?ref= cookie capture"
    expected: "Visit /?ref=TESTCODE, fitc_ref cookie set in DevTools with SameSite=Lax, ~30-day expiry"
    why_human: "Cookie persistence requires real browser session"
  - test: "Leaderboard section absent on landing when no rewarded referrals"
    expected: "Section returns null (not visible) until production data accumulates"
    why_human: "Conditional render depends on live DB data"
  - test: "$5 discount applied at BookSession checkout"
    expected: "Rate reduced by $5 when referral_discount_pending=true, cleared after booking insert"
    why_human: "Requires test account with referral_discount_pending=true in DB"
  - test: "process-referral-reward Edge Function invoked on booking completion"
    expected: "Trainer marks booking complete, Edge Function fires non-blocking, notifications appear"
    why_human: "Requires deployed Edge Function and a completed booking with a pending referral"
---

# Phase 11: Referral Program v1 Verification Report

**Phase Goal:** Drive viral user acquisition through tracked referral incentives.
**Verified:** 2026-03-14
**Status:** human_needed — all automated checks passed, 7 items require browser/DB verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every profiles row has a unique 8-char referral_code (non-null) | VERIFIED | Migration section 1: ADD COLUMN, backfill UPDATE, SET NOT NULL, unique index |
| 2 | referrals table exists with self-referral CHECK and unique(referrer_id, referred_id) | VERIFIED | Migration section 4: CONSTRAINT referrals_no_self_referral + CONSTRAINT referrals_unique_pair |
| 3 | profiles has referral_discount_pending boolean and referral_discount_trainer_id uuid columns | VERIFIED | Migration section 2: both columns added with NOT NULL DEFAULT false and FK |
| 4 | payout_transactions.initiated_by CHECK includes 'referral' | VERIFIED | Migration section 3: constraint dropped and re-added with ('trainer', 'auto', 'referral') |
| 5 | get_referral_leaderboard() RPC returns top 10 by rewarded referrals this calendar month | VERIFIED | Migration section 6: ROW_NUMBER() OVER, WHERE status='rewarded' AND rewarded_at >= date_trunc('month', now()), LIMIT 10 |
| 6 | referral.ts exports captureReferralCode, readReferralCode, clearReferralCode, buildReferralLink | VERIFIED | referral.ts: all 4 functions exported, SameSite=Lax cookie, 30-day expiry, fitc_ref cookie name |
| 7 | process-referral-reward Edge Function accepts { booking_id } and processes reward idempotently | VERIFIED | index.ts: booking_id parsed from POST body, idempotency via .update.eq('status','pending').select('id') + !updated?.length guard |
| 8 | Trainer referral: $10 payout_transactions credit with initiated_by='referral' and status='completed' | VERIFIED | index.ts line 84-91: payout_transactions.insert({ amount: 10.00, status: 'completed', initiated_by: 'referral' }) |
| 9 | Client referral: referral_discount_pending=true set on referring client's profile | VERIFIED | index.ts line 137-143: profiles.update({ referral_discount_pending: true }) |
| 10 | Referral marked status='rewarded' before reward inserted (double-reward guard) | VERIFIED | index.ts: update to 'rewarded' at line 66-72, insert at line 84 — order guaranteed in same await chain |
| 11 | In-app notification inserted for referrer at reward time | VERIFIED | index.ts: notifications.insert() present in both reward branches (lines 107-114, 152-159) |
| 12 | Resend email sent non-blocking (error caught and logged) | VERIFIED | index.ts: fetch().catch() pattern in both branches (lines 118-128, 168-179) |
| 13 | TrainerDashboard overview tab shows ReferralWidget | VERIFIED | TrainerDashboard.tsx line 11: import, lines 283-285: {profile?.referral_code && <ReferralWidget />} in overview section |
| 14 | ClientDashboard shows ReferralWidget | VERIFIED | ClientDashboard.tsx line 6: import, lines 111-113: {profile?.referral_code && <ReferralWidget />} |
| 15 | Landing.tsx reads ?ref= param on mount and writes fitc_ref cookie | VERIFIED | Landing.tsx: useSearchParams, useEffect calls captureReferralCode(refCode) when param present |
| 16 | RoleSelect records attribution + fires attribution-time notification to referrer | VERIFIED | RoleSelect.tsx: readReferralCode(), referrals.insert(), clearReferralCode(), notifications.insert() with type='referral_new' — all in silent try/catch |

**Score:** 16/16 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260316000000_referral_system.sql` | All referral schema: referrals table, referral_code backfill, discount columns, payout constraint, leaderboard RPC | VERIFIED | 142 lines, all 7 sections present including handle_new_user trigger update |
| `src/lib/referral.ts` | Cookie helpers and link builder | VERIFIED | 20 lines, 4 exports, SameSite=Lax, fitc_ref cookie name |
| `supabase/functions/process-referral-reward/index.ts` | Idempotent reward processing for both reward types | VERIFIED | 189 lines, both reward branches, idempotency guard, non-blocking Resend |
| `src/components/shared/ReferralWidget.tsx` | Referral code display with copy button | VERIFIED | 54 lines, buildReferralLink wired, toast.success fires |
| `src/pages/Landing.tsx` | Cookie capture from ?ref= on mount + leaderboard render | VERIFIED | captureReferralCode in useEffect, ReferralLeaderboard after TrustSafety |
| `src/pages/RoleSelect.tsx` | Attribution recording after role selection | VERIFIED | readReferralCode + referrals.insert + notifications.insert in silent catch |
| `src/pages/BookSession.tsx` | $5 referral discount at checkout | VERIFIED | finalRate = Math.max(0, rate - 5), clears flag after booking insert |
| `src/pages/TrainerBookings.tsx` | process-referral-reward invocation on booking completion | VERIFIED | fire-and-forget fetch on status === 'completed' with .catch() |
| `src/components/landing/ReferralLeaderboard.tsx` | Top 10 referrers leaderboard | VERIFIED | supabase.rpc('get_referral_leaderboard'), async skeleton, returns null on empty |
| `src/pages/TrainerDashboard.tsx` | ReferralWidget in overview tab | VERIFIED | Imported and rendered with referral_code null guard, positioned before payouts/analytics tabs |
| `src/pages/ClientDashboard.tsx` | ReferralWidget below quick actions | VERIFIED | Imported and rendered with referral_code null guard |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `referral.ts` | `document.cookie` | SameSite=Lax 30-day cookie named fitc_ref | WIRED | captureReferralCode sets `fitc_ref=...;SameSite=Lax`, readReferralCode parses it |
| `get_referral_leaderboard()` | `public.referrals` | WHERE status='rewarded' AND rewarded_at >= date_trunc | WIRED | SQL in migration confirmed |
| `Landing.tsx` | `src/lib/referral.ts` | captureReferralCode(param) in useEffect on mount | WIRED | Line 10 import, line 18 call |
| `RoleSelect.tsx` | `public.referrals` | supabase.from('referrals').insert() after readReferralCode() | WIRED | Line 39-44 confirmed |
| `RoleSelect.tsx` | `public.notifications` | supabase.from('notifications').insert() after referrals.insert() | WIRED | Line 55-62 confirmed, type='referral_new' |
| `ReferralWidget.tsx` | `src/lib/referral.ts` | buildReferralLink(referralCode) | WIRED | Line 4 import, line 12 call |
| `process-referral-reward/index.ts` | `public.payout_transactions` | adminClient.from('payout_transactions').insert({ initiated_by: 'referral' }) | WIRED | Line 84-91 confirmed |
| `process-referral-reward/index.ts` | `public.referrals` | UPDATE status='rewarded' before inserting credit | WIRED | Lines 66-72, idempotency guard confirmed |
| `process-referral-reward/index.ts` | `api.resend.com/emails` | fetch (non-blocking, .catch logs error) | WIRED | Lines 118-128 and 168-179 confirmed |
| `BookSession.tsx` | `public.profiles` | SELECT referral_discount_pending, UPDATE false after booking | WIRED | Lines 190-194 (select), 229-232 (clear) confirmed |
| `TrainerBookings.tsx` | `supabase/functions/process-referral-reward` | fire-and-forget fetch on status='completed' | WIRED | Lines 159-175 confirmed |
| `ReferralLeaderboard.tsx` | `supabase.rpc('get_referral_leaderboard')` | useEffect on mount, async skeleton | WIRED | Line 19 confirmed |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| REFERRAL-01 | 11-01, 11-03 | Each user has a unique referral code visible on profile with shareable link | SATISFIED | referral_code column in migration; ReferralWidget on both dashboards with buildReferralLink |
| REFERRAL-02 | 11-02, 11-04 | Trainer refers client → client books → trainer earns $10 payout credit | SATISFIED | process-referral-reward: payout_transactions.insert({ amount: 10, initiated_by: 'referral' }) |
| REFERRAL-03 | 11-02, 11-04 | Client refers trainer → trainer books that client → client gets $5 discount | SATISFIED | process-referral-reward sets referral_discount_pending=true; BookSession applies Math.max(0, rate-5) |
| REFERRAL-04 | 11-01, 11-03 | Cookie attribution: link → cookie → new user → referrals table → credit on first booking | SATISFIED | Landing captures ?ref=, RoleSelect inserts referrals row, reward fires on first completed booking |
| REFERRAL-05 | 11-01, 11-04 | Top 10 referrers leaderboard on landing page, refreshes monthly | SATISFIED | get_referral_leaderboard() RPC with monthly filter; ReferralLeaderboard on Landing |
| REFERRAL-06 | 11-02, 11-03 | Referral notifications: in-app + email at attribution time and reward time | SATISFIED | RoleSelect: attribution-time notification (type='referral_new'); Edge Function: reward-time notification + Resend email |

All 6 REFERRAL requirements are satisfied. No orphaned requirements found. All 6 IDs from plan frontmatter are accounted for in REQUIREMENTS.md traceability table.

---

## Anti-Patterns Found

No anti-patterns detected across all 9 modified/created files. No TODOs, FIXMEs, placeholder returns, empty handlers, or stub implementations found.

---

## Human Verification Required

### 1. Referral Code Widget — Trainer Dashboard

**Test:** Log in as a trainer, open TrainerDashboard, click Overview tab.
**Expected:** 8-char referral code displayed with "Copy Link" button in a bordered card. Clicking "Copy Link" shows sonner toast "Referral link copied!" and button briefly shows "Copied!".
**Why human:** UI rendering, clipboard API, and toast behavior require a live browser session.

### 2. Referral Code Widget — Client Dashboard

**Test:** Log in as a client, open ClientDashboard.
**Expected:** ReferralWidget renders below the quick actions grid with the same copy-link behavior.
**Why human:** UI rendering requires browser.

### 3. Landing Page Cookie Capture

**Test:** Navigate to `http://localhost:5173/?ref=TESTCODE` in a fresh browser session.
**Expected:** DevTools > Application > Cookies shows `fitc_ref=TESTCODE` with SameSite=Lax and approximately 30-day expiry, path=/.
**Why human:** Cookie persistence requires real browser session.

### 4. Landing Page Leaderboard

**Test:** Open the landing page and scroll to the bottom.
**Expected:** If no rewarded referrals exist in DB, the leaderboard section is absent (returns null). Once referrals are rewarded in production, the section appears with top 10 + rank highlights.
**Why human:** Conditional render depends on live DB state.

### 5. $5 Discount at BookSession Checkout

**Test:** Set `referral_discount_pending = true` for a client profile in the DB. Log in as that client and book a session with a trainer rate of e.g. $30.
**Expected:** Booking is created with `rate_charged = 25.00`. Profile's `referral_discount_pending` flips to `false` after booking insert. Rate cannot go below $0 (Math.max guard).
**Why human:** Requires a test account with DB state and a payment flow.

### 6. process-referral-reward Edge Function End-to-End

**Test:** Deploy the migration and Edge Function. Create a trainer-refers-client scenario: trainer with referral code, new client signs up via referral link, client completes first booking. Trainer marks it complete in TrainerBookings.
**Expected:** Edge Function fires non-blocking; trainer receives in-app notification ("$10 credit added") and Resend email; payout_transactions row inserted with `initiated_by='referral'`; referrals row status changes to 'rewarded'.
**Why human:** Requires deployed Supabase environment, Edge Function deployment, and real booking flow.

### 7. RoleSelect Attribution Flow

**Test:** Set a `fitc_ref=<VALID_CODE>` cookie manually. Log in as a brand-new user (no role yet). Complete role selection.
**Expected:** `referrals` table gets a new row with the correct referrer_id and referred_id. Referrer gets an in-app notification (type='referral_new'). Cookie is cleared after attribution. Role selection is never blocked even if the referral code is invalid.
**Why human:** Requires test accounts and DB inspection.

---

## Gaps Summary

No gaps. All automated checks passed. The phase goal is structurally achieved — all database schema, Edge Function logic, cookie attribution, UI components, and reward wiring are substantively implemented and correctly connected. The 7 human verification items above are standard integration/E2E tests that confirm the running system, not gaps in implementation.

---

_Verified: 2026-03-14_
_Verifier: Claude (gsd-verifier)_
