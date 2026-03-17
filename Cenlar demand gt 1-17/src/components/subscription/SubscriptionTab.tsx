import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { useTier } from '@/hooks/useTier';
import { getPortalUrl } from '@/lib/subscription';
import type { Tier } from '@/lib/tierGates';
import DowngradeModal from '@/components/subscription/DowngradeModal';

const SubscriptionTab: React.FC = () => {
  const { trainerProfile } = useAuthStore();
  const { tier, isTrialing, trialEndsAt } = useTier();
  const [loading, setLoading] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { url } = await getPortalUrl();
      window.location.href = url;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to open subscription portal';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const tierName =
    tier === 'elite' ? 'Elite' : tier === 'pro' ? 'Pro' : 'Free';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      {/* Tier Badge */}
      <div className="border border-ink/10 p-8 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
          Current Plan
        </p>
        <p className="text-2xl serif font-light italic text-ink">
          {tierName}
          {isTrialing && ' \u2014 Trialing'}
        </p>
        {isTrialing && trialEndsAt && (
          <p className="text-sm text-ink/50">
            until {formatDate(trialEndsAt)}
          </p>
        )}
        {!isTrialing &&
          trainerProfile?.subscription_status === 'active' &&
          trainerProfile.current_period_end && (
            <p className="text-sm text-ink/50">
              {trainerProfile.cancel_at_period_end ? 'Cancels' : 'Renews'}{' '}
              {formatDate(trainerProfile.current_period_end)}
            </p>
          )}
        {tier === 'free' && (
          <p className="text-sm text-ink/50">
            Start a trial to unlock more features
          </p>
        )}
      </div>

      {/* Actions */}
      {tier !== 'free' ? (
        <div className="space-y-4">
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            className="border border-accent text-accent px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Opening portal...' : 'Manage Subscription'}
          </button>
          {!trainerProfile?.cancel_at_period_end && (
            <div>
              <button
                onClick={() => setShowDowngradeModal(true)}
                className="text-ink/40 text-[11px] uppercase tracking-[0.2em] hover:text-red-600 transition-colors"
              >
                Downgrade to Free
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <Link
            to="/pricing"
            className="inline-block border border-accent text-accent px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300"
          >
            Explore Plans
          </Link>
        </div>
      )}

      {/* Downgrade Modal */}
      <DowngradeModal
        isOpen={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
        onConfirm={handleManageSubscription}
        currentTier={tier as Tier}
        loading={loading}
      />
    </div>
  );
};

export default SubscriptionTab;
