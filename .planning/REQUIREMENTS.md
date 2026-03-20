# v5.0 Requirements — App Store Ready

**Milestone:** v5.0 "App Store Ready"
**Goal:** FitRush is polished, fully functional, and ready for Apple App Store submission. All critical UX flows work end-to-end for clients, trainers, and admins.

---

## MOBILE — Capacitor iOS Polish

- [ ] MOBILE-01: App launches on iOS simulator without crashes
- [ ] MOBILE-02: All navigation works with safe area insets (notch, home indicator)
- [ ] MOBILE-03: Capacitor status bar and splash screen configured with FitRush branding
- [ ] MOBILE-04: Native keyboard handling — inputs don't get obscured
- [ ] MOBILE-05: Pull-to-refresh on key list screens (bookings, trainer search, notifications)

## RESPONSIVE — Mobile-First Responsive Design

- [ ] RESP-01: Landing page renders correctly at 375px, 390px, 414px widths
- [ ] RESP-02: Trainer search filters collapse to stacked layout on mobile
- [ ] RESP-03: Trainer cards are full-width single column on mobile
- [ ] RESP-04: Login/signup form is centered and usable on mobile
- [ ] RESP-05: Trainer dashboard tabs work on mobile (horizontal scroll or dropdown)
- [ ] RESP-06: Client dashboard responsive at all breakpoints
- [ ] RESP-07: Booking wizard steps are mobile-friendly (no horizontal overflow)
- [ ] RESP-08: Map view is full-screen on mobile with floating filter chips

## AUTH — Authentication Hardening

- [ ] AUTH-01: Email sign-in and sign-up work end-to-end (confirmation email, redirect back)
- [ ] AUTH-02: Forgot password flow works (reset email sent, password updated)
- [ ] AUTH-03: Role selection (client/trainer) works after first sign-up
- [ ] AUTH-04: Auth errors show user-friendly messages (never raw JSON)
- [ ] AUTH-05: Protected routes redirect to login with return URL

## TRAINER — Trainer Dashboard Completeness

- [ ] TRAINER-01: Trainer can complete onboarding (profile, specialty, rate, photo, certifications)
- [ ] TRAINER-02: Trainer can create/edit/delete availability slots
- [ ] TRAINER-03: Trainer can view bookings (upcoming, past, cancelled)
- [ ] TRAINER-04: Trainer can toggle Go Live / Sleep with timer
- [ ] TRAINER-05: Trainer can view earnings analytics and request payouts
- [ ] TRAINER-06: Trainer can manage subscription (upgrade, downgrade, cancel)
- [ ] TRAINER-07: Trainer dashboard shows motivational tagline on entry
- [ ] TRAINER-08: Trainer can log session notes and exercises after a booking

## CLIENT — Client Experience Completeness

- [ ] CLIENT-01: Client can search trainers by location, specialty, price
- [ ] CLIENT-02: Client can view trainer profiles with reviews, availability
- [ ] CLIENT-03: Client can book a session through the booking wizard
- [ ] CLIENT-04: Client can view their bookings (upcoming, past)
- [ ] CLIENT-05: Client can cancel a booking (within 24hr policy)
- [ ] CLIENT-06: Client can leave a review after a completed session
- [ ] CLIENT-07: Client Fitness Passport is complete and visible to trainers
- [ ] CLIENT-08: Client can configure notification preferences

## ADMIN — Admin Dashboard Verification

- [ ] ADMIN-01: Admin can view all users with role badges
- [ ] ADMIN-02: Admin can suspend/unsuspend users
- [ ] ADMIN-03: Admin can view platform revenue and booking analytics
- [ ] ADMIN-04: Admin can manage subscription tiers and override

## POLISH — Visual & Copy Polish

- [ ] POLISH-01: Trainer dashboard tagline — motivational idle-hours messaging
- [ ] POLISH-02: No placeholder/mock data visible in production (remove MOCK_TRAINERS fallback)
- [ ] POLISH-03: All images optimized and loading (no broken images)
- [ ] POLISH-04: Consistent loading states (skeletons, not spinners) across all pages
- [ ] POLISH-05: Error states are actionable everywhere (retry buttons, clear messages)
- [ ] POLISH-06: 404 page is polished with search
- [ ] POLISH-07: Terms of Service page has real content structure
- [ ] POLISH-08: Privacy Policy page has real content structure

## PERF — Performance & Build

- [ ] PERF-01: Bundle size under 1MB gzipped (currently 418KB — good)
- [ ] PERF-02: Lighthouse mobile score > 80
- [ ] PERF-03: No console errors in production build
- [ ] PERF-04: All 140+ tests passing

---

*v5.0 — 42 requirements across 7 categories*
