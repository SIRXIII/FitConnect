import type { TierFeature, Tier } from '@/lib/tierGates';

const FEATURE_COPY: Record<TierFeature, { label: string; description: string }> = {
  analytics_advanced: {
    label: 'Pro Feature',
    description: 'Time-range charts, booking heatmap, and CSV export are available on Pro and Elite.',
  },
  extended_bio: {
    label: 'Pro Feature',
    description: 'Write a longer bio (up to 1000 characters) on Pro and Elite.',
  },
  slots_ten: {
    label: 'Pro Feature',
    description: 'Show up to 10 availability slots to clients on Pro.',
  },
  slots_unlimited: {
    label: 'Elite Feature',
    description: 'Show all availability slots to clients on Elite.',
  },
  priority_search: {
    label: 'Pro Feature',
    description: 'Appear above Free trainers in search results on Pro and Elite.',
  },
  featured_landing: {
    label: 'Elite Feature',
    description: 'Appear in the Featured Trainers section on the landing page on Elite.',
  },
};

const FEATURE_NAMES: Record<TierFeature, string> = {
  analytics_advanced: 'Advanced Analytics',
  extended_bio:       'Extended Bio',
  slots_ten:          'More Visibility Slots',
  slots_unlimited:    'Unlimited Visibility',
  priority_search:    'Priority Search',
  featured_landing:   'Featured Placement',
};

interface LockedFeatureBannerProps {
  feature: TierFeature;
  tier: Tier;
}

export const LockedFeatureBanner: React.FC<LockedFeatureBannerProps> = ({ feature }) => {
  const copy = FEATURE_COPY[feature];
  return (
    <div className="border border-ink/10 p-12 text-center space-y-4">
      <p className="text-xs uppercase tracking-[0.3em] text-ink/30">{copy.label}</p>
      <p className="serif text-2xl font-light text-ink">
        {FEATURE_NAMES[feature]}
      </p>
      <p className="text-sm text-ink/50 max-w-sm mx-auto">{copy.description}</p>
      {/* Upgrade CTA placeholder — Phase 15 will add the pricing page link */}
    </div>
  );
};

export default LockedFeatureBanner;
