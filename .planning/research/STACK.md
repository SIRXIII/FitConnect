# Technology Stack

**Project:** FitRush v4.0 — The Live Platform
**Researched:** 2026-03-18
**Confidence:** HIGH (core libraries), MEDIUM (AI matching architecture), MEDIUM (Google Calendar OAuth server-side flow)

---

## Scope

ONLY net-new stack additions for v4.0 features:
1. Google Maps (map view, pins, clustering, Places autocomplete for address entry)
2. Geolocation (browser API + Capacitor iOS)
3. Location-based notifications (push/in-app)
4. Google Calendar bidirectional OAuth sync
5. AI trainer-client matching + AI analytics
6. Session history / workout logging (data model only — no new UI library needed)
7. Email capture (landing page waitlist)

Existing capabilities already in use — do NOT re-add:
- React 19, TypeScript, Vite 6, Tailwind CSS, Zustand, Framer Motion, Recharts
- Supabase (PostgreSQL, Auth, Realtime, Edge Functions/Deno)
- Stripe Connect + Stripe Billing
- Zod + react-hook-form, Vitest, ical.js, browser-image-compression
- Resend.com (transactional email — already wired to Edge Functions)
- Capacitor 8 (iOS shell — already installed)

---

## Recommended Stack Additions

### Google Maps

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@vis.gl/react-google-maps` | latest (^1.x) | Map display, AdvancedMarkers, Places Autocomplete hooks | Google's officially sponsored React library — replaces the unmaintained `@react-google-maps/api`. Provides `APIProvider`, `Map`, `AdvancedMarker`, and `useMapsLibrary` hook for loading Places library lazily. |
| `@googlemaps/markerclusterer` | latest (^2.x) | Cluster nearby trainer pins at lower zoom levels | Google's official clustering library. Used with `@vis.gl/react-google-maps` AdvancedMarkers. Uses the supercluster algorithm internally — no need to install supercluster separately. |

**What NOT to install:**
- `@react-google-maps/api` — older community library, no longer recommended by Google
- `react-places-autocomplete` — unmaintained, last publish 2021
- `supercluster` / `use-supercluster` — only needed if bypassing `@googlemaps/markerclusterer`; redundant here

**Google Maps APIs to enable in GCP console:**
- Maps JavaScript API (map display)
- Places API (New) (address autocomplete with session tokens)
- Geocoding API (lat/lng from address string, optional fallback)

**Pricing context (as of March 2025 new billing model):**
- Maps JavaScript API: 10,000 free map loads/month (Essentials tier), $7/1,000 after
- Places Autocomplete (New): Session-based — free autocomplete requests within a session when terminated by a Place Details call. The $200/month credit was retired March 1, 2025; free tier limits now apply per SKU.
- At FitRush's current scale, Maps costs should remain within free tier limits for the foreseeable future. Monitor via GCP Billing dashboard.

**Integration with existing stack:**
- API key stored in `VITE_GOOGLE_MAPS_API_KEY` env var (web) + Netlify env
- Map component lives inside the existing React SPA routing structure
- Trainer `lat`/`lng` coordinates stored in `trainer_profiles` table (new columns via migration)

---

### Geolocation

| Technology | Purpose | Why |
|-----------|---------|-----|
| `navigator.geolocation` (browser built-in) | One-shot and watched GPS position on web | Zero dependencies. Works on desktop Chrome/Safari/Firefox. Used for "notify me when trainers are near" opt-in. |
| `@capacitor/geolocation` (already installed in Capacitor 8) | GPS on native iOS | Already available via Capacitor 8. Just needs `NSLocationWhenInUseUsageDescription` in `Info.plist`. No additional npm install required. |

**What NOT to install:**
- `capacitor-community/background-geolocation` — background tracking is overkill for the "Uber-style toggle" use case. The toggle sends a presence signal to Supabase when the trainer actively opens the app; background GPS is not required for v4.0.
- Any third-party geolocation wrapper for web — the browser Geolocation API is sufficient.

**Integration note:**
- Write a single `useGeolocation()` hook that calls `Capacitor.isNativePlatform() ? Geolocation.getCurrentPosition() : navigator.geolocation.getCurrentPosition()` for unified cross-platform behavior.
- Permission request on iOS: call `Geolocation.requestPermissions()` before first use; on web, permission is triggered automatically on first call.

---

### Location-Based Notifications

| Technology | Purpose | Why |
|-----------|---------|-----|
| Supabase Realtime (already in use) | In-app "trainer available near you" alerts | Already wired for notifications table. No new library needed — extend existing notification system with a `location_alert` type. |
| `firebase/messaging` (FCM) via Supabase Edge Function | Web push notifications (out-of-tab alerts) | FCM is the standard for web push. Supabase Edge Functions already support FCM webhook pattern. The Supabase docs provide an official example. Only needed if push-when-tab-closed is a v4.0 requirement. |
| Service Worker (Workbox or manual) | Register push subscription, display notification | Required for web push. Vite PWA plugin (`vite-plugin-pwa`) can scaffold this. Adds ~2KB to bundle. |

**Recommendation for v4.0 scope:**
- Start with Supabase Realtime in-app alerts only (zero new dependencies).
- Defer web push (FCM + service worker) to v4.1 if out-of-tab notifications are prioritized. The complexity cost (Firebase project setup, service worker lifecycle, iOS PWA push limitations) is high relative to v4.0 scope.
- For Capacitor iOS, push notifications would use `@capacitor/push-notifications` (separate feature), also deferred.

**What NOT to install now:**
- `vite-plugin-pwa` — defer with web push
- `firebase` package — defer with web push
- `@capacitor/push-notifications` — defer to post-v4.0

---

### Google Calendar Bidirectional OAuth Sync

| Technology | Purpose | Why |
|-----------|---------|-----|
| `googleapis` (npm, used in Supabase Edge Function) | Server-side Google Calendar API calls (read/write events) | Official Google client library. Must run server-side (Edge Function) because it requires `client_secret`. Deno 2.2+ resolves the previous gcp-metadata compatibility issue. |
| `google-auth-library` (npm, peer dep of googleapis) | OAuth2 token exchange and refresh in Edge Function | Required alongside `googleapis` for token lifecycle management. Use `npm:googleapis` import specifier in Deno Edge Functions. |

**Architecture (server-side is mandatory):**
- Google Calendar OAuth requires `client_secret` — it cannot be safely held in the React SPA
- Flow: React SPA initiates OAuth redirect → Supabase Edge Function `google-calendar-auth` handles the callback, exchanges code for tokens, stores `refresh_token` encrypted in `profiles` table (new column)
- New Edge Functions needed: `google-calendar-auth` (OAuth callback + token storage), `google-calendar-sync` (bidirectional events read/write + watch channel registration)
- Sync token stored per user in DB to enable incremental sync (only changed events fetched)
- Watch channels (Google push to FitRush webhook) expire weekly — Edge Function must renew them via pg_cron

**Known compatibility issue (resolved):**
- January 2025: `gcp-metadata` 6.1.1 broke `googleapis` in Supabase Edge Functions. Fixed by Deno 2.2+. Confirm Supabase project is on current Edge Runtime before deploying.

**What NOT to do:**
- Do not attempt Google Calendar OAuth from the React SPA frontend — `client_secret` cannot be safely stored in browser context
- Do not use `react-google-calendar-api` npm package — unmaintained (last publish 2 years ago), client-side only

---

### AI Trainer-Client Matching + AI Analytics

| Technology | Purpose | Why |
|-----------|---------|-----|
| `pgvector` (Supabase extension, already available) | Store embedding vectors for trainer profiles + Fitness Passports | Already available on Supabase. Enable via migration: `create extension if not exists vector`. Used for cosine similarity matching. |
| OpenAI `text-embedding-3-small` API (via Edge Function) | Generate embeddings from Fitness Passport + trainer profile text | $0.02/1M tokens — negligible cost at FitRush scale. 1536 dimensions. Best quality-to-cost ratio for semantic matching tasks. Calls made server-side from Edge Function, not from browser. |

**Architecture for AI matching:**
- New Edge Function `generate-embeddings` triggered on profile save (via Supabase webhook): embeds trainer specialty + bio + location preferences into a vector stored in `trainer_profiles.embedding vector(1536)`
- New Edge Function `generate-embeddings` also embeds client Fitness Passport (goals, workout types, limitations) into `client_profiles.embedding vector(1536)`
- Matching query: `SELECT trainer_id, 1 - (embedding <=> $client_embedding) AS similarity FROM trainer_profiles ORDER BY similarity DESC LIMIT 10` — runs inside an RPC function, callable from React
- AI analytics (discount recommendations for empty slots): rule-based classification using existing booking data patterns — no embeddings needed for v4.0. Implement as SQL query + Edge Function. True ML deferred per PROJECT.md "Out of Scope."

**What NOT to do:**
- Do not use LangChain or vector database third-party services — pgvector on existing Supabase instance is sufficient and avoids new external dependencies
- Do not train custom models — OpenAI embeddings are sufficient for semantic similarity matching without training data
- Do not call OpenAI API from the React frontend — API key must stay server-side in Edge Function secrets

**Cost estimate:**
- Embedding generation: triggered only on profile create/update. At 1,000 trainers × avg 300 tokens/profile = 300K tokens = $0.006 total. Negligible.
- Matching queries: pure Postgres cosine similarity after embeddings exist — no ongoing OpenAI cost per search.

---

### Session History + Workout Logging

No new npm libraries needed. The feature is a data model + UI extension:

- New Supabase tables: `session_logs` (post-session notes, exercises, duration, mood rating), `workout_templates` (optional v4.1)
- New React components: `SessionLogForm`, `SessionHistoryList`, `ProgressChart` (using existing Recharts)
- Zod schema for `SessionLogSchema` (using existing Zod installation)
- Recharts already covers progress visualization (LineChart for weight/performance trends)

**What NOT to add:**
- No dedicated workout logging library (e.g., `react-workout-logger`) — overkill, Zod + Recharts + Supabase covers all needs
- No separate chart library — Recharts is already installed and used for analytics

---

### Email Capture (Landing Page Waitlist)

No new libraries needed. The full stack is already present:

- New Supabase table: `email_captures (id, email, created_at, source)` with a public insert RLS policy (no auth required) and unique constraint on email
- New Supabase Edge Function `capture-email`: validates email with Zod, inserts to table, sends confirmation via existing Resend integration
- React component: simple controlled input + submit using existing react-hook-form + Zod (already installed)

**What NOT to add:**
- No Mailchimp, ConvertKit, or third-party email list service — Supabase table + Resend covers the requirement without additional vendor dependency
- No new form library — react-hook-form is already installed

---

## Net-New Installation Summary

```bash
# Google Maps (2 packages)
npm install @vis.gl/react-google-maps @googlemaps/markerclusterer

# AI matching — googleapis in Edge Function only (no frontend install)
# Add to Edge Function imports:
# import { google } from "npm:googleapis@137";
# import { OAuth2Client } from "npm:google-auth-library@9";
# import OpenAI from "npm:openai@4";
```

**Total new npm packages for frontend: 2**
All other additions are either server-side (Edge Functions) or use existing installed packages.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Maps library | `@vis.gl/react-google-maps` | `@react-google-maps/api` | Community library, maintenance unclear; Google now sponsors vis.gl |
| Clustering | `@googlemaps/markerclusterer` | `supercluster` + `use-supercluster` | Markerclusterer uses supercluster internally; no reason to bypass |
| AI embeddings | OpenAI `text-embedding-3-small` via Edge Function | Supabase built-in `gte-small` model | `gte-small` (384 dims) is lower quality; OpenAI at $0.02/MTok is negligible cost for better results |
| AI matching store | pgvector (existing Supabase) | Pinecone, Weaviate | No new vendor; pgvector on Supabase is production-ready for FitRush's scale |
| Calendar sync | `googleapis` in Edge Function | `react-google-calendar-api` | Client-side library cannot hold client_secret; server-side is required |
| Web push | Deferred | FCM + `vite-plugin-pwa` | iOS PWA push support is limited; complexity exceeds v4.0 value |
| Email capture | Supabase table + Resend | Mailchimp, ConvertKit | Avoids new vendor; existing Resend integration covers confirmation emails |

---

## Environment Variables (New for v4.0)

```bash
# Frontend (.env / Netlify)
VITE_GOOGLE_MAPS_API_KEY=          # Maps JavaScript API key (restricted to your domain)

# Supabase Edge Function secrets (supabase secrets set)
GOOGLE_CLIENT_ID=                  # OAuth 2.0 Web Client ID
GOOGLE_CLIENT_SECRET=              # OAuth 2.0 Web Client Secret
OPENAI_API_KEY=                    # For text-embedding-3-small calls
```

---

## Sources

- [@vis.gl/react-google-maps official docs](https://visgl.github.io/react-google-maps/) — HIGH confidence
- [Google Maps Platform blog: React components announcement](https://mapsplatform.google.com/resources/blog/introducing-react-components-for-the-maps-javascript-api/) — HIGH confidence
- [@googlemaps/markerclusterer clustering docs](https://developers.google.com/maps/documentation/javascript/marker-clustering) — HIGH confidence
- [Google Maps Platform pricing (new March 2025 model)](https://developers.google.com/maps/billing-and-pricing/pricing) — HIGH confidence
- [Places API (New) session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing) — HIGH confidence
- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) — HIGH confidence
- [Supabase AI embeddings guide](https://supabase.com/docs/guides/ai) — HIGH confidence
- [OpenAI text-embedding-3-small pricing](https://openai.com/api/pricing/) — HIGH confidence ($0.02/MTok)
- [Capacitor Geolocation plugin docs](https://capacitorjs.com/docs/apis/geolocation) — HIGH confidence
- [Google Calendar API push notifications](https://developers.google.com/workspace/calendar/api/guides/push) — HIGH confidence
- [googleapis + Supabase Edge Function gcp-metadata fix](https://github.com/orgs/supabase/discussions/33244) — MEDIUM confidence (community discussion, Deno 2.2 fix confirmed)
- [Supabase push notifications example (FCM)](https://supabase.com/docs/guides/functions/examples/push-notifications) — HIGH confidence (deferral recommendation is editorial)
