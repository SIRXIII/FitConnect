---
phase: 27
slug: location-based-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 27 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Quick run command** | `npx vitest run src/hooks/useNotificationPreferences.test.ts src/hooks/useLookingNow.test.ts` |
| **Full suite command** | `npx vitest run` |

## Wave 0 Test Map

| Test File | Covers | Requirements |
|-----------|--------|-------------|
| `src/hooks/useNotificationPreferences.test.ts` | Preferences CRUD, master toggle, gate check | NOTIF-01, NOTIF-04, NOTIF-06 |
| `src/hooks/useLookingNow.test.ts` | GPS toggle, 2hr auto-disable, position state | NOTIF-02 |
