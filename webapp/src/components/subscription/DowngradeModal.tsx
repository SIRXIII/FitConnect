import { X } from 'lucide-react';
import { featuresLostOnDowngrade } from '@/lib/subscription';
import type { Tier, TierFeature } from '@/lib/tierGates';

const FEATURE_NAMES: Record<TierFeature, string> = {
  slots_ten: 'Up to 10 visibility slots',
  slots_unlimited: 'Unlimited visibility slots',
  extended_bio: 'Extended bio (1,000 characters)',
  analytics_advanced: 'Advanced analytics dashboard',
  priority_search: 'Priority search ranking',
  featured_landing: 'Featured on landing page',
};

interface DowngradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentTier: Tier;
  loading: boolean;
}

const DowngradeModal: React.FC<DowngradeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentTier,
  loading,
}) => {
  if (!isOpen) return null;

  const lostFeatures = featuresLostOnDowngrade(currentTier, 'free');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
      <div className="bg-paper border border-ink/10 p-8 max-w-md w-full mx-4 space-y-6">
        <h2 className="text-xl serif font-light italic text-ink">
          Downgrade to Free?
        </h2>
        <p className="text-sm text-ink/60">
          You will lose access to these features:
        </p>
        <ul className="space-y-3">
          {lostFeatures.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <X className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-ink/70">
                {FEATURE_NAMES[feature]}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-4 pt-2">
          <button
            onClick={onClose}
            className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 text-white px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Confirm Downgrade'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DowngradeModal;
