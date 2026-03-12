---
phase: 1
slug: payment-security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test suite exists in this project |
| **Config file** | None (Wave 0 must create if needed) |
| **Quick run command** | Manual verification per task |
| **Full suite command** | Manual regression: booking flow end-to-end |
| **Estimated runtime** | ~5 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual verification step described in PLAN.md task
- **After every plan wave:** Manual regression check of booking flow end-to-end
- **Before `/gsd:verify-work`:** All 5 requirement success criteria met
- **Max feedback latency:** N/A (manual verification)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | REQ-SEC-01 | manual | N/A | ❌ | ⬜ pending |
| 01-01-02 | 01 | 1 | REQ-SEC-01 | manual | N/A | ❌ | ⬜ pending |
| 01-02-01 | 02 | 1 | REQ-SEC-02 | manual | N/A | ❌ | ⬜ pending |
| 01-03-01 | 03 | 1 | REQ-SEC-03 | manual | N/A | ❌ | ⬜ pending |
| 01-04-01 | 04 | 1 | REQ-SEC-04 | manual | N/A | ❌ | ⬜ pending |
| 01-05-01 | 05 | 1 | REQ-SEC-05 | manual | `grep -r "GEMINI" dist/` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No test infrastructure exists. All Phase 1 validations are manual/smoke-test based. Test infrastructure will be established in a later phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payment intent created before booking in DB | REQ-SEC-01 | No test framework; requires Stripe test mode | 1. Start booking flow 2. Check DB: no booking until PI succeeds 3. Cancel mid-flow: verify cleanup |
| Abandoned pending bookings cancelled | REQ-SEC-01 | Requires time-based trigger observation | 1. Create booking, abandon 2. Wait for cleanup trigger 3. Verify booking cancelled |
| Special chars stripped from search | REQ-SEC-02 | No test framework | 1. Enter `'; DROP TABLE--` in location 2. Verify sanitized output |
| Location strings > 50 chars truncated | REQ-SEC-02 | No test framework | 1. Enter 100-char string 2. Verify truncation |
| Client cannot read another client's bookings | REQ-SEC-03 | Requires two auth sessions | 1. Log in as Client A 2. Try to access Client B's booking ID via API |
| Trainer cannot modify another trainer's slots | REQ-SEC-03 | Requires two auth sessions | 1. Log in as Trainer A 2. Try to update Trainer B's slot via API |
| Unauthenticated Edge Function calls return 401 | REQ-SEC-04 | Requires curl/API testing | 1. Call each Edge Function without Bearer token 2. Verify 401 response |
| GEMINI_API_KEY absent from client bundle | REQ-SEC-05 | Build verification | 1. Run `npm run build` 2. `grep -r "GEMINI" dist/` should return nothing |

---

## Validation Sign-Off

- [ ] All tasks have manual verify steps
- [ ] Sampling continuity: manual check after each task
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
