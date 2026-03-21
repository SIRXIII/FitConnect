---
created: 2026-03-21T01:32:00.000Z
title: Email signup confirmation flow not delivering emails
area: auth
files:
  - src/stores/auth.ts
  - src/pages/Login.tsx
  - src/pages/AuthCallback.tsx
---

## Problem

When a personal trainer (or client) tries to create an account via email signup, they never receive the confirmation email from Supabase. This blocks all new user registration — trainers who want to sign up after seeing marketing/outreach can't create accounts.

Without working email signup, we can't:
1. Onboard new trainers from local Corona outreach
2. Let clients who find the site create accounts
3. Collect real user signups from marketing efforts

This is the #1 blocker for going to market.

## Solution

1. **Check Supabase email provider settings** — Supabase Dashboard → Authentication → Email Templates → verify SMTP is configured
2. **Supabase free tier uses built-in mailer** which has strict rate limits (3-4 emails/hour). For production, need to configure a custom SMTP provider:
   - Resend.com (already used for other emails — `RESEND_API_KEY` is in secrets)
   - Or configure Supabase Auth to use Resend as custom SMTP
3. **Verify Site URL** in Supabase Auth settings points to `https://fitconnect-2sn.pages.dev`
4. **Verify Redirect URLs** in Supabase Auth → URL Configuration includes `https://fitconnect-2sn.pages.dev/auth/callback`
5. **Alternative**: Enable "Confirm email" toggle OFF in Supabase Auth for now (lets users sign up without email confirmation) — faster but less secure
6. **CoWork task**: Check Supabase Auth logs for failed email deliveries
