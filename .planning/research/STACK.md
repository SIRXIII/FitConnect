# Stack Research

**Domain:** Fitness marketplace SPA — v3.0 new feature additions
**Researched:** 2026-03-17
**Confidence:** HIGH (core libraries), MEDIUM (Google Calendar OAuth architecture in SPA context)

---

## Scope

ONLY net-new stack additions for v3.0:
1. Calendar Sync (iCal export/import + Google Calendar bidirectional)
2. Trainee Fitness Passport (avatar upload, fitness intake forms)
3. Security Hardening (Zod at all boundaries, RLS audit, race-condition fixes)
4. UX Polish

Existing capabilities (React 19, Supabase, Stripe, Zustand, Tailwind v4, Vitest, Zod 4.3.6, Recharts, Resend, Framer Motion, react-router-dom) are NOT re-documented.

**Key existing fact:** Zod 4.3.6 is already in `package.json`. No upgrade needed. Edge Functions already use the `npm:` import specifier pattern (confirmed in `create-payment-intent/index.ts`).

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `ical.js` | `^2.2.1` | Parse and generate iCalendar (.ics) RFC 5545 data | Zero npm dependencies, pure ESM — runs in both the browser (React SPA) and Deno Edge Functions via `npm:ical.js`. Used by Mozilla Calendar for years. v2.x is the actively maintained fork. Handles recurrence rules (RRULE), timezones, VEVENT/VCALENDAR structure. The only library to use for both client-side .ics import and server-side .ics generation. |
| Google Identity Services (GIS) | Script CDN, not npm | OAuth 2.0 token grant for Google Calendar API scopes in the browser | Google's current auth library — replaces the deprecated `gapi.auth2`. Loaded via `<script src="https://accounts.google.com/gsi/client">`. The `initTokenClient()` flow requests short-lived access tokens for Calendar scopes without exposing a client secret. Actual Calendar REST calls go through a Supabase Edge Function, not the browser, to protect token handling. |
| `react-hook-form` | `^7.71.2` | Multi-field fitness intake forms and profile editing | Fitness Passport forms have 10+ fields (goals, limitations, injuries, experience level, preferred workout types). `react-hook-form` handles field registration, dirty tracking, field arrays for dynamic goal lists, and controlled/uncontrolled inputs without re-rendering the whole form on each keystroke. The project has no form library today — adding it is justified here. |
| `@hookform/resolvers` | `^5.2.2` | Bridge between react-hook-form and Zod 4 validation | v5.2.2 explicitly added Zod v4 support (alongside v3 compatibility) with automatic runtime detection. Required whenever using Zod schemas to validate react-hook-form inputs. Do NOT use resolvers v4.x with Zod 4 — type-level breakage was fixed in v5.2.x only. |
| `browser-image-compression` | `^2.0.2` | Client-side avatar image compression before Supabase Storage upload | Compresses JPEG/PNG/WebP in a Web Worker (non-blocking UI). TypeScript types are bundled. Reduces avatar payloads before they hit Supabase Storage — avoids the Pro plan Image Transformation feature for the common case of "upload-then-display." Last npm publish was 2022 but 2.0.2 is stable and API-complete. 392k weekly downloads. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pgTAP` | Built into Supabase CLI | SQL-level unit tests for RLS policies | Write `.sql` test files in `supabase/tests/`. Run via `supabase test db` locally and in CI. Required for RLS audit phase — policy violations fail silently (no error thrown; rows are just missing), making pgTAP the only reliable way to assert access is correctly denied. |
| `@types/google.accounts` | `^0.0.x` (dev) | TypeScript type declarations for the GIS script global | The GIS library loads at runtime via a `<script>` tag, giving you a `window.google` global. Without this dev package, TypeScript doesn't know the type of `google.accounts.oauth2.initTokenClient`. Install as a dev dependency only. |
| Google Calendar REST API (raw `fetch`) | N/A — HTTP | Read/write calendar events using the GIS access token | Do NOT use the `@googleapis/calendar` npm package in the SPA or Edge Functions — it adds ~3MB and is designed for Node.js server environments. The REST API at `https://www.googleapis.com/calendar/v3/` is fully stable. Use raw `fetch` with `Authorization: Bearer <token>` header. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `supabase test db` | Run pgTAP RLS tests against local Supabase | Requires `supabase start`. Test files in `supabase/tests/`. Already available via the existing Supabase CLI — zero new tooling needed. |
| Supabase Dashboard — Auth — Policies | RLS policy audit starting point | Use the "Policies" view to enumerate all tables and their current policies before writing pgTAP tests. Faster to audit visually first, then automate. |

---

## Installation

```bash
# React SPA — new dependencies
npm install ical.js react-hook-form @hookform/resolvers browser-image-compression

# TypeScript types for GIS script global (dev only)
npm install -D @types/google.accounts
```

```html
<!-- index.html — GIS script (NOT an npm package) -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

```typescript
// Deno Edge Function — import patterns (no install, inline specifiers)

// ical.js in Edge Functions
import ICAL from 'npm:ical.js';

// Zod is already available via npm: (project already uses this pattern)
import { z } from 'npm:zod';
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Raw `fetch` to Google Calendar REST | `@googleapis/calendar@14.2.0` npm | Only if you need service account / domain-wide delegation for admin-level calendar operations. For per-user OAuth token flows, REST + GIS is simpler and avoids ~3MB bundle. |
| `browser-image-compression` (client-side) | Supabase Storage Image Transformations | Supabase image transforms are a Pro plan paid feature. Use Supabase transforms when you need on-the-fly *serving* at multiple sizes (e.g., thumbnails in lists rendered from CDN URLs). Use `browser-image-compression` to reduce upload payload size — it's free at all plan tiers and runs before the file ever leaves the device. Both can be used together. |
| `react-hook-form` + `@hookform/resolvers` | Plain `useState` + manual validation | For simple 1-3 field forms (login, search). Fitness intake forms have 10+ fields, conditional visibility (e.g., "injury details" shown only if "has injuries" is checked), and dynamic field arrays for goals/limitations. `useFieldArray` and `useWatch` from RHF handle these patterns cleanly. |
| `ical.js` (runtime-agnostic) | `node-ical` | `node-ical` has `node:http` internals — Deno-incompatible. Only choose `node-ical` if the functions runtime ever migrates to Node.js. |
| `pgTAP` SQL tests | JavaScript integration tests impersonating JWT role | JS tests exercise the HTTP API layer; pgTAP tests exercise the Postgres policy layer. pgTAP is authoritative for RLS because it runs inside the DB transaction context with the correct `auth.uid()` value. Use both; pgTAP is the ground truth. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@googleapis/calendar` npm package in SPA | ~3MB bundle addition; designed for Node.js; requires managing OAuth refresh flow in browser JS which is a security risk. | Raw `fetch` to `https://www.googleapis.com/calendar/v3/` with GIS access token. |
| `gapi.auth2` (legacy Google auth) | Deprecated and shut down by Google in 2023. | Google Identity Services (`accounts.google.com/gsi/client`). |
| `compressorjs@1.2.1` | Last published 2022, not actively maintained, no native TypeScript types bundled, fewer weekly downloads than `browser-image-compression`. | `browser-image-compression@2.0.2`. |
| `node-ical` or `ical` npm packages | Node.js-specific internals. Will not work in Deno Edge Functions. | `ical.js@2.2.1` — runtime-agnostic. |
| Storing Google OAuth refresh tokens in `localStorage` or Supabase DB | Refresh tokens for Google Calendar are extremely sensitive — leaking one gives calendar read/write access indefinitely. Google's own guidelines say: never persist refresh tokens in browser storage for SPAs. | Use GIS token model for short-lived access tokens. Request a new access token on demand via `prompt: 'none'` (silent re-auth). For persistent sync, exchange for a refresh token server-side via an Edge Function and store encrypted in Supabase with service-role-only read access. |
| React Big Calendar or FullCalendar | Both ship with React 18 peer dependency assumptions and add >200KB bundle. The FitRush calendar UI is a list of time slots, not a full scheduling grid. | Simple `<ul>`-based slot list styled with Tailwind v4 and animated with Framer Motion (already installed). |
| Zod v3 syntax with existing Zod 4 install | The project is on Zod `4.3.6`. v4 moved format validators to top-level functions: `z.email()` not `z.string().email()`. v4's `z.uuid()` enforces RFC 4122. Writing v3-style validators creates silent type drift and runtime errors at validation boundaries. | Zod v4 API exclusively throughout all new code. |
| `@hookform/resolvers@4.x` with Zod 4 | v4.x of resolvers has type incompatibilities with Zod v4's changed generic signatures. Fixed in v5.2.2. | `@hookform/resolvers@^5.2.2`. |

---

## Stack Patterns by Feature

**Calendar Sync — iCal Export (trainer schedule as downloadable .ics):**
- New Edge Function `export-calendar` generates .ics using `npm:ical.js`
- React client calls the function, receives .ics text, triggers browser download via `new Blob([icsText], { type: 'text/calendar' })` + `URL.createObjectURL`
- No new frontend library needed for export

**Calendar Sync — iCal Import (trainer uploads external .ics file):**
- React SPA reads the uploaded file, parses with `ical.js` (frontend install)
- Extracted VEVENT data maps to the bookings/availability schema
- Validation with Zod 4 before any Supabase write

**Calendar Sync — Google Calendar Bidirectional:**
1. Trainer clicks "Connect Google Calendar" — GIS `initTokenClient` triggers OAuth consent
2. Access token returned to browser — stored in React state only (never localStorage)
3. SPA calls new Edge Function `sync-google-calendar` with the token + user_id
4. Edge Function calls Google Calendar REST API (`fetch`) to read/write events
5. Results written to `bookings` / `availability_slots` tables
6. Token expiry: GIS access tokens last ~1 hour; request fresh token with `prompt: 'none'` on next sync

**Trainee Fitness Passport — Avatar Upload:**
1. User selects image file
2. `browser-image-compression` compresses to <500KB, max 1200px wide
3. Upload to Supabase Storage bucket `avatars/{user_id}/{uuid}.webp`
4. RLS policy on `avatars` bucket: authenticated user can only INSERT/UPDATE their own path prefix (`storage.foldername(name)[1] = auth.uid()::text`)
5. Display via `supabase.storage.from('avatars').getPublicUrl(path)` — no server transform needed post-compression

**Trainee Fitness Passport — Intake Form:**
- `react-hook-form` with `useFieldArray` for dynamic goals / limitations lists
- Zod 4 schema validates on blur + on submit
- `@hookform/resolvers@5.2.2` wires schema to form
- Submitted data writes to `trainee_profiles` table (new migration)

**Security Hardening — Zod at Edge Function Boundaries:**
- Import `npm:zod` in Deno functions (project already uses `npm:` pattern)
- Parse `await req.json()` through a Zod schema as the FIRST action in every function
- Return `400` with `error.issues` on schema failure
- Prevents downstream SQL injections from malformed JSON payloads
- Pattern confirmed working with Deno's `npm:` specifier

**Security Hardening — RLS Audit:**
- Write pgTAP tests in `supabase/tests/` covering all 18 existing migrations
- Test pattern for denied access: `SET local request.jwt.claims = '{"sub":"<other-user-uuid>"}'; SELECT is_empty(SELECT * FROM table WHERE ...)`
- Test pattern for allowed access: confirm row count = expected
- Run with `supabase test db` — integrates with existing CI workflow

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react-hook-form@7.71.2` | `react@19.2.1` | RHF v7 targets React 18+; React 19 is backward compatible. No known issues. |
| `@hookform/resolvers@5.2.2` | `zod@4.3.6` | v5.2.2 added explicit Zod v4 support. DO NOT use v4.x resolvers with Zod 4. |
| `ical.js@2.2.1` | Deno via `npm:ical.js` | Pure ESM, zero Node.js built-in dependencies. Deno `npm:` specifier confirmed working. Fallback: `import ICAL from 'https://esm.sh/ical.js@2.2.1'` if `npm:` causes issues. |
| `ical.js@2.2.1` | Vite 6 (browser bundle) | Standard ESM — Vite handles it natively. No special config needed. |
| `browser-image-compression@2.0.2` | `react@19.2.1`, `vite@6.x` | Browser-only (no SSR). Web Worker path works with Vite's default worker config. TypeScript types bundled in package. |
| GIS script (`accounts.google.com/gsi/client`) | All SPA environments | Runtime-loaded script — no bundle impact. `@types/google.accounts` provides TS declarations. |
| `zod@4.3.6` (already installed) | `npm:zod` in Deno | Same version imported in both environments. Use `import { z } from 'npm:zod'` in Edge Functions to match SPA's Zod v4 validation schemas. |

---

## Sources

- [ical.js npm](https://www.npmjs.com/package/ical.js) — version 2.2.1 confirmed, zero dependencies, 102 dependents
- [ical.js GitHub](https://github.com/kewisch/ical.js) — actively maintained, RFC 5545 + 6350 support
- [Google Calendar API auth scopes](https://developers.google.com/workspace/calendar/api/auth) — `calendar.events` scope for read/write
- [Google Identity Services overview](https://developers.google.com/identity/gsi/web/guides/overview) — GIS as replacement for `gapi.auth2`
- [GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) — `initTokenClient`, short-lived access tokens, SPA pattern
- [Google OAuth2 PKCE for SPAs — client secret requirement](https://ktaka.blog.ccmp.jp/2025/07/oogle-oauth2-and-pkce-understanding.html) — Google requires secret even with PKCE for web app types; SPA token model avoids this
- [Supabase NPM compatibility in Edge Functions](https://supabase.com/features/npm-compatibility) — `npm:` specifier confirmed in Deno
- [Supabase Storage Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) — Pro plan only; justifies client-side compression for free/starter plans
- [browser-image-compression npm](https://www.npmjs.com/package/browser-image-compression) — version 2.0.2, TypeScript types bundled, Web Worker support
- [react-hook-form npm](https://www.npmjs.com/package/react-hook-form) — version 7.71.2 current (March 2026)
- [@hookform/resolvers npm](https://www.npmjs.com/package/@hookform/resolvers) — version 5.2.2, Zod v4 support confirmed
- [Zod v4 changelog](https://zod.dev/v4/changelog) — breaking changes from v3, format validators moved to top-level functions
- [hookform/resolvers Zod v4 issue](https://github.com/react-hook-form/resolvers/issues/799) — v5.2.2 fix confirmed
- [pgTAP Supabase testing docs](https://supabase.com/docs/guides/local-development/testing/overview) — `supabase test db` workflow, RLS test patterns
- [Testing RLS policies with pgTAP](https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602) — silent failure behavior, `is_empty()` pattern
- `Cenlar demand gt 1-17/package.json` — confirmed `zod@4.3.6` already installed, all existing deps
- `supabase/functions/create-payment-intent/index.ts` — confirmed `npm:stripe@14.25.0` import pattern in Deno

---
*Stack research for: FitConnect v3.0 — Calendar Sync, Trainee Profiles, Security Hardening, UX Polish*
*Researched: 2026-03-17*
