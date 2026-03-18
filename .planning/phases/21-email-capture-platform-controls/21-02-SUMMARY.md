---
phase: 21-email-capture-platform-controls
plan: 02
subsystem: ui
tags: [react, framer-motion, zod, sonner, vitest, gcp]

# Dependency graph
requires:
  - phase: 21-01
    provides: waitlist-signup Edge Function and waitlistSchema in schemas.ts

provides:
  - Hero email capture form with AnimatePresence idle/submitted states
  - Hero.test.tsx with 4 Vitest tests covering WAITLIST-01/02/03
  - GCP-SETUP-CHECKLIST.md for Maps billing controls and OAuth consent screen

affects:
  - Phase 23 (Maps — needs GCP API key from checklist)
  - Phase 28 (Calendar Sync — needs OAuth verification started now)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AnimatePresence mode="wait" with keyed motion.div states for Hero section transitions
    - Zod 4 uses result.error.issues (not .errors) for validation error access
    - framer-motion mock pattern: AnimatePresence renders children, motion.div renders plain div

key-files:
  created:
    - Cenlar demand gt 1-17/src/components/landing/Hero.test.tsx
    - .planning/phases/21-email-capture-platform-controls/GCP-SETUP-CHECKLIST.md
  modified:
    - Cenlar demand gt 1-17/src/components/landing/Hero.tsx

key-decisions:
  - "No waitlist position number shown (CONTEXT.md locked decision overriding WAITLIST-03 literal)"
  - "Input type=text instead of type=email to allow Zod validation to show custom error messages (browser HTML5 validation blocks form submit for invalid emails before onSubmit fires in jsdom)"
  - "Zod 4 API: result.error.issues[0].message, not result.error.errors[0].message"

patterns-established:
  - "AnimatePresence mode=wait pattern: wrap conditional content in AnimatePresence, give each branch a unique key prop on motion.div"
  - "Zod 4 safeParse error access: use result.error.issues not result.error.errors"

requirements-completed: [WAITLIST-01, WAITLIST-03]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 21 Plan 02: Hero Email Capture + GCP Checklist Summary

**Hero section rebuilt with AnimatePresence email waitlist form (idle/submitted states), 4 Vitest tests passing, and GCP setup checklist for Maps billing and OAuth verification**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T20:58:53Z
- **Completed:** 2026-03-18T21:05:16Z
- **Tasks:** 3 (+ checkpoint awaiting human verify)
- **Files modified:** 3

## Accomplishments
- Hero.test.tsx: 4 tests covering WAITLIST-01/02/03, all passing (RED then GREEN TDD cycle)
- Hero.tsx: Email capture form replaces CTA buttons; AnimatePresence transitions to "You're In." state on submit; Sonner toast; no position number shown
- GCP-SETUP-CHECKLIST.md: Maps API key setup with HTTP referrer restrictions, $10/month billing budget, OAuth consent screen steps for Phase 28

## Task Commits

Each task was committed atomically:

1. **Task 0: Hero.test.tsx failing tests (RED)** - `8274f7c` (test)
2. **Task 1: Hero.tsx email form with AnimatePresence (GREEN)** - `44e75da` (feat)
3. **Task 2: GCP Setup Checklist** - `df3ec29` (chore)

_Note: TDD tasks have separate RED and GREEN commits_

## Files Created/Modified
- `Cenlar demand gt 1-17/src/components/landing/Hero.tsx` - Email capture form, AnimatePresence idle/submitted states, handleSubmit with Zod validation and fetch
- `Cenlar demand gt 1-17/src/components/landing/Hero.test.tsx` - 4 tests: idle state, invalid email error, valid email transition, no position number
- `.planning/phases/21-email-capture-platform-controls/GCP-SETUP-CHECKLIST.md` - Manual GCP setup instructions for Maps and Calendar

## Decisions Made
- Input uses `type="text"` not `type="email"`: browser HTML5 constraint validation in jsdom blocks form submission for invalid email inputs before the React `onSubmit` handler fires, preventing our Zod validation error from displaying. `type="text"` lets the submit event reach our handler, and Zod provides the validation.
- Zod 4 breaking change: `result.error.issues` (not `.errors`). Plan template used Zod 3 API; fixed automatically.
- No waitlist position number: per CONTEXT.md locked decision, the submitted state shows "You're In." confirmation only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed input type from email to text for Zod validation compatibility**
- **Found during:** Task 1 (Hero.tsx implementation, GREEN phase)
- **Issue:** `type="email"` on the input causes jsdom's HTML5 constraint validation to block form `submit` events when the value is invalid, so `handleSubmit` never fires and Zod's error message never displays
- **Fix:** Changed `type="email"` to `type="text"` — Zod handles email format validation via `.email()`, browser-native validation is redundant
- **Files modified:** `Cenlar demand gt 1-17/src/components/landing/Hero.tsx`
- **Verification:** Test "shows error on invalid email submit without calling fetch" passes
- **Committed in:** `44e75da` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Zod 4 API: .issues instead of .errors**
- **Found during:** Task 1 (GREEN phase debugging)
- **Issue:** Plan template used `result.error.errors[0]?.message` which is Zod 3 API. Project uses Zod 4.3.6 where the property is `result.error.issues`
- **Fix:** Changed `result.error.errors[0]?.message` to `result.error.issues[0]?.message`
- **Files modified:** `Cenlar demand gt 1-17/src/components/landing/Hero.tsx`
- **Verification:** All 4 Hero tests pass with correct error message displayed
- **Committed in:** `44e75da` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for tests to pass. No scope creep. Changes are minimal and contained to Hero.tsx.

## Issues Encountered
- Pre-existing test failures in `AdminDashboard.test.tsx` (grid layout assertion) and `useTrainers.test.ts` — unrelated to this plan, logged to deferred items. Hero tests all pass.

## User Setup Required
None - GCP checklist is documentation for manual human action, not automated setup.

## Next Phase Readiness
- Hero email form is live and ready for human visual verification (Task 3 checkpoint)
- GCP checklist ready for manual execution before Phase 23
- WAITLIST-01 and WAITLIST-03 requirements satisfied

---
*Phase: 21-email-capture-platform-controls*
*Completed: 2026-03-18*
