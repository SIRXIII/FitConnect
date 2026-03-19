---
phase: 28
slug: google-calendar-bidirectional-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 28 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Quick run command** | `npx vitest run src/lib/gcal.test.ts` |
| **Full suite command** | `npx vitest run` |

## Wave 0 Test Map

| Test File | Covers | Requirements |
|-----------|--------|-------------|
| `src/lib/gcal.test.ts` | buildGcalEvent, parseGcalBlockedSlots, isGcalConnected helpers | CALSYNC-02, CALSYNC-03 |
