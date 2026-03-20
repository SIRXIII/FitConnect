---
phase: 23
slug: map-view-trainer-locations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `Cenlar demand gt 1-17/vite.config.ts` |
| **Quick run command** | `cd "Cenlar demand gt 1-17" && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd "Cenlar demand gt 1-17" && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Wave 0 Requirements

- [ ] `src/components/search/MapView.test.tsx` — stubs for MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06
- [ ] `src/components/trainer/LocationManager.test.tsx` — stubs for LOC-01, LOC-02, LOC-03, LOC-04
- [ ] Mock for `@vis.gl/react-google-maps` — Google Maps cannot render in jsdom

*All map rendering tests must mock the Google Maps library. Test filter logic, state, and prop passing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Map renders with pins | MAP-01 | jsdom cannot render Google Maps canvas | Open search page, verify map shows with trainer pins |
| Pin clustering at zoom levels | MAP-01 | Clustering is visual/zoom-dependent | Zoom out on map, verify pins cluster with count badge |
| Drag-to-adjust pin | LOC-02 | Drag interaction requires real browser | Add location, verify pin is draggable on preview map |
| Places Autocomplete suggestions | LOC-01 | Requires live Google API | Type address, verify suggestions appear |
| Bottom sheet on mobile | MAP-01 | Requires Capacitor/iOS viewport | Test on iOS device or simulator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
