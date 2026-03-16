---
phase: 1
slug: payment-security-hardening
plan: 01
status: in_progress
wave_count: 2
created: 2026-03-13
---

# Phase 1 — Plan 01: Payment & Security Hardening

**Goal:** Eliminate all 5 critical security vulnerabilities.

**Requirements covered:** REQ-SEC-01, REQ-SEC-02, REQ-SEC-03, REQ-SEC-04, REQ-SEC-05

---

## Wave 1 — Quick Wins

Tasks are independent and touch different files.

### Task 01 — REQ-SEC-05: Remove GEMINI_API_KEY from client bundle

**File:** `Cenlar demand gt 1-17/vite.config.ts`

Remove the `define` block (lines 17–19) that bakes `GEMINI_API_KEY` into the Vite client bundle.
The key is not used anywhere in source code — removal has zero functional impact.

**Steps:**
1. Delete the `define: { ... }` block from `vite.config.ts`
2. Run `npm run build` in project directory
3. Run `grep -r "GEMINI" dist/` — must return empty

**Verification:** `grep -r "GEMINI" dist/` returns no output after build.

**Commit:** `fix(security): remove GEMINI_API_KEY from client bundle [REQ-SEC-05]`

---

### Task 02 — REQ-SEC-02: Sanitize trainer location search input

**Files:**
- New: `Cenlar demand gt 1-17/src/lib/sanitize.ts`
- Edit: `Cenlar demand gt 1-17/src/hooks/useTrainers.ts`

`useTrainers.ts` line 46 passes raw `options.location` directly to `ilike()`. While Supabase
parameterizes queries (preventing true injection), unsanitized input enables DoS via excessive
regex backtracking and bypasses rate limiting by charset abuse.

**Steps:**
1. Create `src/lib/sanitize.ts` with `sanitizeSearchInput()`:
   - Strip chars not in `[a-zA-Z0-9\s,.\-']`
   - Cap at 50 characters
   - Trim whitespace
2. In `useTrainers.ts`, import and apply sanitizer before `ilike()` call
3. Skip query entirely if sanitized result is empty string

**Verification:** Enter `'; DROP TABLE--` in location search; network request shows sanitized value.

**Commit:** `fix(security): sanitize trainer location search input [REQ-SEC-02]`

---

### Task 03 — REQ-SEC-03: Audit and document all RLS policies

**Files:**
- Read: `Cenlar demand gt 1-17/supabase/migrations/20260311143000_fitconnect_current_schema.sql`
- New: `.planning/codebase/RLS_POLICIES.md`

All 7 tables have RLS enabled in the migration. This task reads and documents every policy,
verifying correctness of the row-level isolation.

**Key policies to verify:**
- `bookings`: `client_id = auth.uid() OR trainer_id = auth.uid()` for SELECT
- `payments`: `auth.role() = 'service_role'` for INSERT (Edge Functions only)
- `availability_slots`: trainer can only modify own slots
- `reviews`: client can only create review for own completed booking
- `trainer_profiles`: trainer can only update own profile

**Steps:**
1. Read migration file, extract all CREATE POLICY statements
2. Write `.planning/codebase/RLS_POLICIES.md` with one table section each
3. Mark any policy gaps found

**Verification:** RLS_POLICIES.md exists with all 7 tables documented.

**Commit:** `docs(security): audit and document all Supabase RLS policies [REQ-SEC-03]`

---

## Wave 2 — Core Fixes

Tasks are independent and can run after Wave 1 completes.

### Task 04 — REQ-SEC-01: Fix payment race condition + abandoned booking cleanup

**Files:**
- Edit: `Cenlar demand gt 1-17/src/pages/BookSession.tsx`
- New: `Cenlar demand gt 1-17/supabase/migrations/20260313_cleanup_abandoned_bookings.sql`

**Current broken flow:**
1. Client inserts booking (status=pending) ← booking exists in DB
2. Client calls create-payment-intent Edge Function
3. If step 2 fails → booking is an orphaned `pending` record with no payment

**Fix approach (simpler — no Edge Function refactor needed):**
- On PI failure (catch block): immediately DELETE the booking before showing error
- Add DB cleanup function for the browser-close edge case (user closes tab between steps 1 and 2)
- Also remove redundant `apikey` header from fetch call (anti-pattern)

**Steps:**
1. In `BookSession.tsx` catch block (~line 207): add `await supabase.from('bookings').delete().eq('id', data.id)` then show clean error
2. Remove `apikey` header from fetch headers at line 193
3. Create SQL migration with `public.cleanup_abandoned_bookings()` SECURITY DEFINER function

**Verification:** Create booking → DevTools Network shows PI fetch failing → confirm booking row deleted from DB.

**Commit:** `fix(security): delete orphaned booking on payment failure; add cleanup function [REQ-SEC-01]`

---

### Task 05 — REQ-SEC-04: Edge Function auth audit + send-notification-email

**Files:**
- Read: `Cenlar demand gt 1-17/supabase/functions/create-connect-account/index.ts`
- New: `Cenlar demand gt 1-17/supabase/functions/send-notification-email/index.ts`

Both `create-payment-intent` and `create-connect-account` already verify JWT via
`userClient.auth.getUser()`. `stripe-webhook` uses Stripe signature (correct). The missing piece
is `send-notification-email` — deployed on Supabase but not in the repo.

**Steps:**
1. Read `create-connect-account/index.ts` — add body validation if missing
2. Create `send-notification-email/index.ts` with:
   - JWT auth pattern (identical to create-payment-intent lines 31–49)
   - Body validation: `to`, `subject`, `body` required → 400 if missing
   - Stub implementation: log + return 200 (email provider TBD)

**Verification:** Call function without Bearer token → 401 response.

**Commit:** `feat(security): add send-notification-email edge function with JWT auth [REQ-SEC-04]`

---

## Success Criteria

| Req | Criterion | Verified |
|-----|-----------|---------|
| REQ-SEC-01 | PI failure path deletes booking immediately; cleanup function handles browser-close | ⬜ |
| REQ-SEC-02 | Location search strips non-allowed chars, caps at 50 | ⬜ |
| REQ-SEC-03 | All 7 tables documented in RLS_POLICIES.md | ⬜ |
| REQ-SEC-04 | All 4 Edge Functions have JWT auth; send-notification-email in repo | ⬜ |
| REQ-SEC-05 | GEMINI_API_KEY absent from built bundle | ⬜ |
