import { useAuthStore } from '@/stores/auth';
import { TIER_GATES, type Tier, type TierFeature } from '@/lib/tierGates';

export function useTier() {
  const { trainerProfile } = useAuthStore();
  const tier = ((trainerProfile?.subscription_tier) ?? 'free') as Tier;
  const isTrialing = trainerProfile?.subscription_status === 'trialing';
  const trialEndsAt = trainerProfile?.trial_ends_at ?? null;
  return { tier, isTrialing, trialEndsAt };
}

export function useCan(feature: TierFeature): boolean {
  const { tier, isTrialing } = useTier();
  if (isTrialing) return true; // trial = full Pro-level access to all features
  return TIER_GATES[feature].includes(tier);
}
