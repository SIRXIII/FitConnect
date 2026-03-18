# RLS Policy Verification Matrix — Phase 17

**Audit date:** 2026-03-17
**Auditor:** Automated security scan
**Result:** PASS — 40+ policies across 14 tables

## Table-by-Table Verification

| Table | RLS Enabled | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|-------------|--------|--------|--------|--------|-------|
| `profiles` | ✅ | Own row + trainers see booked clients | Own row only | Own row only | — | Safe |
| `trainer_profiles` | ✅ | Public (needed for search) | Service role | Own row (tier locked by trigger) | — | `guard_subscription_tier_write` trigger blocks tier self-modification |
| `availability_slots` | ✅ | Based on visibility rules | Trainers own | Trainers own | Trainers own | `get_visible_slots` RPC enforces tier limits |
| `bookings` | ✅ | Client or trainer party | Authenticated | Trainer (accept/reject) | — | Status transitions validated |
| `reviews` | ✅ | Public | Clients with booking | — | — | One review per booking enforced |
| `notifications` | ✅ | Own user | Service role | Own (mark read) | — | Safe |
| `payments` | ✅ | Own booking party | Service role only | Service role only | — | Webhook-driven, never client-writable |
| `payout_transactions` | ✅ | Trainer own | Service role | Service role | — | Safe |
| `platform_settings` | ✅ | Admin only | Admin only | Admin only | — | Safe |
| `client_profiles` | ✅ | Own + trainers with booking | Own row | Own row | — | Safe |
| `conversations` | ✅ | Participant | Authenticated | — | — | Safe |
| `messages` | ✅ | Conversation participant | Authenticated | — | — | Safe |
| `referrals` | ✅ | Own referrals | Service role | Service role | — | Safe |
| `subscription_events` | ✅ | Trainer own + admin all | Service role | — | — | Idempotency key prevents duplicates |

## Critical Security Controls

1. **`subscription_tier` is write-protected** — `guard_subscription_tier_write()` trigger on `trainer_profiles` blocks any UPDATE to `subscription_tier` unless the request comes from service_role or explicitly sets `tier_overridden_by`
2. **Payments are service-role only** — No authenticated user can INSERT or UPDATE payments; only Stripe webhooks via service_role
3. **Admin actions are role-gated** — Admin RLS policies check `profiles.role = 'admin'` via subquery
4. **Public read on trainer_profiles** — Required for search/discovery; no sensitive data exposed (no PII beyond public profile info)

## Recommendations

- ✅ All tables have RLS enabled (no gaps)
- ✅ Service-role paths are correctly isolated
- ⚠️ Consider adding `audit_log` policies once table exists (Plan 2)
- ⚠️ Future: Rate limiting on public endpoints (Supabase doesn't natively support; consider Edge Function wrapper)

## Conclusion

**SEC-03: PASS** — RLS coverage is comprehensive. No tables lack policies. Write-sensitive columns (subscription_tier, payment status) have additional trigger/service-role guards beyond RLS.
