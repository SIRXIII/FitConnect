import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { startTrial } from '@/lib/subscription';
import type { BillingInterval } from '@/lib/subscription';
import type { Tier } from '@/lib/tierGates';
import BillingToggle from '@/components/subscription/BillingToggle';
import PricingTable from '@/components/subscription/PricingTable';

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const trainerProfile = useAuthStore((s) => s.trainerProfile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [interval, setInterval] = useState<BillingInterval>('month');
  const [loading, setLoading] = useState(false);

  const currentTier: Tier | null = trainerProfile
    ? (trainerProfile.subscription_tier as Tier)
    : null;
  const isTrialing = trainerProfile?.subscription_status === 'trialing';
  const isAuthenticated = !!user;

  const handleStartTrial = async (tier: 'pro' | 'elite', billingInterval: BillingInterval) => {
    setLoading(true);
    try {
      await startTrial(tier, billingInterval);
      toast.success('Trial started! Setting up your account...');
      // Give webhook time to update profile
      await new Promise((r) => setTimeout(r, 2000));
      await fetchProfile(user!.id);
      navigate('/trainer/dashboard?tab=subscription');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start trial';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const tierName = currentTier
    ? currentTier.charAt(0).toUpperCase() + currentTier.slice(1)
    : '';

  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="space-y-4">
          <h1 className="text-3xl serif font-light italic text-ink text-center">
            Choose Your Plan
          </h1>
          <p className="text-sm text-ink/50 text-center">
            Start with a 30-day free trial. No credit card required.
          </p>
        </div>

        <div className="flex justify-center">
          <BillingToggle interval={interval} onToggle={setInterval} />
        </div>

        <PricingTable
          interval={interval}
          currentTier={currentTier}
          isTrialing={isTrialing}
          onStartTrial={handleStartTrial}
          loading={loading}
          isAuthenticated={isAuthenticated}
        />

        {isTrialing && (
          <p className="text-xs text-ink/40 text-center">
            You're currently trialing {tierName}. Manage your subscription from the dashboard.
          </p>
        )}
      </div>
    </div>
  );
};

export default Pricing;
