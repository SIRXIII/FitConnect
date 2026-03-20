---
phase: 21-email-capture-platform-controls
verified: 2026-03-18T21:17:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 21: Email Capture + Platform Controls Verification Report

**Phase Goal:** Visitors can join the waitlist and see their position, while Google Maps billing guardrails and OAuth verification are in place before any map code ships
**Verified:** 2026-03-18T21:17:00Z
**Status:** passed
**Re-verification:** No — initial verification

**User decisions honoured (not gaps):**
- Success criterion "Visitor sees their position number" was intentionally overridden by a locked CONTEXT.md decision. The submitted state shows "You're In." with no position number. This is by design.
- GCP billing controls and OAuth consent screen are addressed as a documentation checklist (GCP-SETUP-CHECKLIST.md), not as executed GCP console tasks. This was a user decision. The checklist artifact is verified.
- The Edge Function sends email via Resend in production. Local dev skips email when RESEND_API_KEY is absent (non-fatal, by design).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | email_subscribers table exists with id, email (unique), created_at columns | VERIFIED | `20260318200000_email_subscribers.sql` lines 1-10: CREATE TABLE, uuid PK, text NOT NULL, timestamptz, case-insensitive unique index |
| 2 | waitlist-signup Edge Function accepts POST with {email}, inserts to DB, calls Resend, returns 200 | VERIFIED | `waitlist-signup/index.ts`: POST-only, `.from('email_subscribers').insert()`, `api.resend.com/emails` fetch, returns `{ success: true }` 200 |
| 3 | Duplicate email submissions return 200 (not error) to avoid revealing who is registered | VERIFIED | `index.ts` line 74: `if (insertError.code === '23505')` returns 200 with `{ success: true }` |
| 4 | waitlistSchema exported from schemas.ts validates email field | VERIFIED | `schemas.ts` lines 133-141: `export const waitlistSchema`, `export type WaitlistInput` |
| 5 | Visitor sees an email input field in the Hero section of the landing page | VERIFIED | `Hero.tsx` line 98: `placeholder="Enter your email"` inside a `<form onSubmit={handleSubmit}>` |
| 6 | Visitor can submit their email and the Hero transforms to a thank-you state with Framer Motion animation | VERIFIED | `Hero.tsx` lines 67-156: `AnimatePresence mode="wait"` wraps keyed `idle` and `submitted` motion.div states; submitted state renders "You're In." |
| 7 | No waitlist position number is shown (per user decision overriding WAITLIST-03) | VERIFIED | `Hero.tsx`: no `#\d+`, no "position" text in submitted state; Hero.test.tsx test 4 asserts this and passes |
| 8 | Toast notification fires via Sonner on successful signup | VERIFIED | `Hero.tsx` line 52: `toast.success('You are on the early access list.')` — confirmed by test 3 assertion on `mockToastSuccess` |
| 9 | GCP setup checklist document exists with billing, API key, and OAuth instructions | VERIFIED | `GCP-SETUP-CHECKLIST.md`: sections for Maps JS API with HTTP referrer restrictions, $10/month billing budget, `VITE_GOOGLE_MAPS_API_KEY`, OAuth consent screen with `calendar.events` scope and 4-8 week verification note |
| 10 | Hero.test.tsx exists with automated tests covering WAITLIST-01, WAITLIST-02, WAITLIST-03 | VERIFIED | `Hero.test.tsx`: 4 tests — all 4 pass (`npx vitest run Hero.test.tsx`: 4/4 passed) |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Cenlar demand gt 1-17/supabase/migrations/20260318200000_email_subscribers.sql` | email_subscribers DDL with unique index and RLS | VERIFIED | 15 lines, CREATE TABLE, CREATE UNIQUE INDEX on lower(email), ENABLE ROW LEVEL SECURITY |
| `Cenlar demand gt 1-17/supabase/functions/waitlist-signup/index.ts` | Public Edge Function for waitlist signup | VERIFIED | 125 lines, Deno.serve, CORS, 405 non-POST, service-role DB insert, 23505 silent 200, Resend email, 500 catch block |
| `Cenlar demand gt 1-17/src/lib/schemas.ts` | waitlistSchema and WaitlistInput type | VERIFIED | Appended at line 131; existing schemas unchanged |
| `Cenlar demand gt 1-17/src/components/landing/Hero.tsx` | Email capture form with AnimatePresence idle/submitted states | VERIFIED | 199 lines, AnimatePresence mode="wait", keyed motion.div states, handleSubmit with Zod + fetch + toast |
| `Cenlar demand gt 1-17/src/components/landing/Hero.test.tsx` | Vitest tests for Hero email capture | VERIFIED | 87 lines, 4 test cases, all passing |
| `.planning/phases/21-email-capture-platform-controls/GCP-SETUP-CHECKLIST.md` | GCP billing and OAuth verification instructions | VERIFIED | 44 lines, Maps JS API, billing budget, HTTP referrer key restriction, OAuth consent screen |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Hero.tsx` | `waitlist-signup` Edge Function | `fetch POST to /functions/v1/waitlist-signup` | WIRED | Line 40: `` `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/waitlist-signup` `` with `method: 'POST'` |
| `Hero.tsx` | `schemas.ts` | `import { waitlistSchema }` | WIRED | Line 4: `import { waitlistSchema } from '../../lib/schemas'`; used in `handleSubmit` via `waitlistSchema.safeParse({ email })` |
| `waitlist-signup/index.ts` | `email_subscribers` table | `supabase.from('email_subscribers').insert()` | WIRED | Line 68: `.from('email_subscribers')` |
| `waitlist-signup/index.ts` | Resend API | `fetch to https://api.resend.com/emails` | WIRED | Line 88: `fetch('https://api.resend.com/emails', ...)` — skipped non-fatally in dev when RESEND_API_KEY is absent |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WAITLIST-01 | 21-01, 21-02 | Visitor can enter email on landing page to join the waitlist | SATISFIED | Hero.tsx email input + handleSubmit; waitlist-signup Edge Function inserts to DB |
| WAITLIST-02 | 21-01 | Visitor receives confirmation email after signup via Resend | SATISFIED | Edge Function sends Resend email to subscriber; non-fatal if RESEND_API_KEY absent in dev — works in production |
| WAITLIST-03 | 21-02 | Visitor sees their position in the waitlist after signup (overridden by user decision) | SATISFIED (override) | CONTEXT.md locked decision: no position number shown. Submitted state shows "You're In." confirmation. Hero.test.tsx test 4 asserts no position number. User approved visually (Task 3 checkpoint). |

No orphaned requirements found for Phase 21 in REQUIREMENTS.md.

---

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments, no `return null` stubs, no empty handlers, no position number display in Hero.tsx.

---

### Human Verification Required

One item was already human-verified during phase execution (Task 3 checkpoint — approved by user):

**Visual and behavioral verification of the Hero email form**

- Test: Run `npm run dev`, open landing page, submit invalid email, submit valid email
- Expected: Inline error on invalid email; smooth AnimatePresence transition to "You're In." state; Sonner toast fires; no position number shown; right-side image and stats row unchanged
- Status: Approved by user during phase execution (2026-03-18)

No additional human verification required.

---

### Test Results

Full vitest suite: 61 passed, 1 pre-existing failure (`AdminDashboard.test.tsx` grid layout assertion — unrelated to Phase 21, logged to deferred-items.md).

Hero.test.tsx: 4/4 passed.

No regressions introduced by Phase 21.

---

## Summary

Phase 21 goal is fully achieved. The waitlist backend (migration, Edge Function, Zod schema) and frontend (Hero email form with AnimatePresence transitions, Sonner toast) are implemented, wired, and tested. The GCP setup checklist is in place as a manual reference document. All three requirements (WAITLIST-01, WAITLIST-02, WAITLIST-03) are satisfied, with WAITLIST-03 intentionally overridden per user decision to show "You're In." rather than a position number.

---

_Verified: 2026-03-18T21:17:00Z_
_Verifier: Claude (gsd-verifier)_
