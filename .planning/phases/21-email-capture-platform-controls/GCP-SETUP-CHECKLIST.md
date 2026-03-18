# GCP Platform Controls Setup Checklist

**Phase:** 21 - Email Capture + Platform Controls
**Purpose:** Prepare Google Cloud Platform billing safeguards and OAuth verification before any Maps or Calendar code ships.
**Action required:** Manual — complete these steps in the GCP Console.

---

## 1. Google Cloud Project Setup
- [ ] Create new GCP project named "fitrush-prod" (or add to existing)
- [ ] Note Project ID (format: fitrush-prod-XXXXXX)
- [ ] Enable billing account on the project

## 2. Maps JavaScript API
- [ ] Enable "Maps JavaScript API" in APIs & Services > Library
- [ ] Create an API key in APIs & Services > Credentials
- [ ] Under "Application restrictions" select "HTTP referrers (websites)"
  - Add: `https://fitrush-app.netlify.app/*`
  - Add: `http://localhost:3000/*` (dev only — remove before production)
- [ ] Under "API restrictions" select "Restrict key" then choose "Maps JavaScript API"
- [ ] Save the key as `VITE_GOOGLE_MAPS_API_KEY` in `.env.local` and Netlify environment variables

## 3. Billing Budget Alert
- [ ] Go to Billing > Budgets & alerts
- [ ] Create budget: Scope = "fitrush-prod" project, Amount = $10/month
- [ ] Set alert thresholds: 50%, 90%, 100%
- [ ] Add email recipient for budget alerts

## 4. Google OAuth Consent Screen (for Calendar Sync — Phase 28)
- [ ] Go to APIs & Services > OAuth consent screen
- [ ] App type: External
- [ ] App name: FitRush
- [ ] User support email: your email
- [ ] Authorized domains: fitrush-app.netlify.app
- [ ] Scopes: add `https://www.googleapis.com/auth/calendar.events`
- [ ] Add test users (for development before verification completes)
- [ ] Submit for verification
- [ ] **Note:** Verification takes 4-8 weeks. Start immediately — Phase 28 cannot ship to production users until verification is complete.

---

*Created: Phase 21 planning*
*Prerequisite for: Phase 23 (Maps), Phase 28 (Calendar Sync)*
