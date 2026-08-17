export type StripeSetupState = 'none' | 'incomplete' | 'connected';

export function stripeSetupState(
  profile: { stripe_account_id?: string | null; payouts_enabled?: boolean | null } | null | undefined
): StripeSetupState {
  if (!profile || !profile.stripe_account_id) {
    return 'none';
  }

  if (profile.payouts_enabled) {
    return 'connected';
  }

  return 'incomplete';
}
