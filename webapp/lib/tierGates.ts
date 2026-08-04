export type Tier = 'free' | 'pro' | 'elite';

export type TierFeature =
  | 'slots_ten'
  | 'slots_unlimited'
  | 'extended_bio'
  | 'analytics_advanced'
  | 'priority_search'
  | 'featured_landing';

export const TIER_GATES: Record<TierFeature, Tier[]> = {
  slots_ten:          ['pro', 'elite'],
  slots_unlimited:    ['elite'],
  extended_bio:       ['pro', 'elite'],
  analytics_advanced: ['pro', 'elite'],
  priority_search:    ['pro', 'elite'],
  featured_landing:   ['elite'],
};

export const BIO_LIMITS: Record<Tier, number> = {
  free: 280,
  pro: 1000,
  elite: 1000,
};

export function bioLimitForTier(tier: Tier): number {
  return BIO_LIMITS[tier] ?? 280;
}
