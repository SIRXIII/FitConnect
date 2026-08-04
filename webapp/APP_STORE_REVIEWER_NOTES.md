# App Store Connect — Reviewer Notes (Build 5.0.0)

## Demo Accounts

### Trainer Account (Primary Demo)
- Email: hostcalifornia@gmail.com
- Password: FitRush2026!
- Role: Trainer (name: Frank, onboarding complete)

### Client Account
- Email: sirxiii@gmail.com
- Password: FitRush2026!
- Role: Client (name: Xavier Thompson, onboarding complete)

---

## Paste into App Review Information > Notes

```
DEMO ACCOUNTS

Trainer account:
Email: hostcalifornia@gmail.com
Password: FitRush2026!

Client account:
Email: sirxiii@gmail.com
Password: FitRush2026!

Both accounts have completed onboarding and have full access to all app features.

---

ACCOUNT DELETION (Guideline 5.1.1v)

Account deletion is available for both Trainer and Client roles. Steps:

FOR CLIENT (sirxiii@gmail.com):
1. Log in with client credentials above
2. You will land on the Client Dashboard
3. Tap the "Settings" tab in the tab bar
4. Scroll down to the red "Danger Zone" section
5. Tap "Delete My Account"
6. Type "DELETE" in the confirmation field
7. Tap "Permanently Delete Account"
All user data is permanently removed via a server-side edge function (cascading deletion of profile, bookings, reviews, messages, notifications, and auth record).

FOR TRAINER (hostcalifornia@gmail.com):
1. Log in with trainer credentials above
2. You will land on the Trainer Dashboard
3. Tap the "Settings" tab in the tab bar
4. Scroll down to the red "Danger Zone" section
5. Tap "Delete My Account"
6. Same confirmation flow as above

A screen recording demonstrating the full account deletion flow on a physical iPhone is attached.

---

PAYMENTS (Guideline 3.1.1)

FitRush is a physical fitness services marketplace — clients book in-person training sessions with certified personal trainers. All transactions are for physical services (personal training sessions at gyms, parks, and client homes), which qualifies under Guideline 3.1.3(a) for physical goods and services.

The iOS app contains NO links, buttons, or text directing users to external websites for payment or subscription management. Trainer subscription tiers (Free/Pro/Elite) are managed server-side. The iOS app does not display pricing pages, subscription purchase flows, or references to external payment.
```

---

## Checklist Before Submitting
- [ ] Rebuild iOS app with code changes (tab rename + payment link removals)
- [ ] Upload new build to App Store Connect
- [ ] Paste reviewer notes above into App Review Information > Notes
- [ ] Attach screen recording of account deletion flow (filmed on physical iPhone)
- [ ] Set demo account credentials in App Store Connect: hostcalifornia@gmail.com / FitRush2026!
- [ ] Submit for review
