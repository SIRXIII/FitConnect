import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BillingInterval, PlanPricing } from '@/lib/subscription';
import type { Tier } from '@/lib/tierGates';

interface PlanCardProps {
  plan: PlanPricing;
  interval: BillingInterval;
  currentTier: Tier | null;
  isTrialing: boolean;
  onStartTrial: (tier: 'pro' | 'elite', interval: BillingInterval) => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  interval,
  currentTier,
  isTrialing,
  onStartTrial,
  loading,
  isAuthenticated,
}) => {
  const isCurrentPlan = currentTier === plan.tier;
  const isPaid = plan.tier === 'pro' || plan.tier === 'elite';
  const currentIsPaid = currentTier === 'pro' || currentTier === 'elite';

  const cardClass = [
    'border p-8 space-y-6',
    plan.highlighted
      ? 'border-accent/30 ring-1 ring-accent/10'
      : 'border-ink/10',
  ].join(' ');

  const ctaClass =
    'bg-ink text-white px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-colors w-full';
  const disabledClass = 'opacity-50 cursor-not-allowed';

  // Price display
  const renderPrice = () => {
    if (plan.tier === 'free') {
      return (
        <div>
          <span className="text-3xl font-light">$0</span>
          <p className="text-xs text-ink/40 mt-1">Free forever</p>
        </div>
      );
    }

    if (interval === 'month') {
      return (
        <div>
          <span className="text-3xl font-light">${plan.monthlyPrice}</span>
          <span className="text-sm text-ink/40">/mo</span>
        </div>
      );
    }

    return (
      <div>
        <span className="text-3xl font-light">${plan.annualMonthly.toFixed(2)}</span>
        <span className="text-sm text-ink/40">/mo</span>
        <p className="text-xs text-ink/40 mt-1">billed ${plan.annualPrice.toFixed(2)}/year</p>
      </div>
    );
  };

  // CTA logic
  const renderCTA = () => {
    // Free tier
    if (plan.tier === 'free') {
      // Only show "Current Plan" for authenticated users actually on free tier
      if (isAuthenticated && (currentTier === 'free' || currentTier === null)) {
        return (
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 text-center">
            Current Plan
          </p>
        );
      }
      // Non-authenticated: show Get Started CTA
      if (!isAuthenticated) {
        return (
          <Link
            to="/login?mode=signup"
            className={`${ctaClass} block text-center`}
          >
            Get Started
          </Link>
        );
      }
      return null;
    }

    // Active subscriber on this tier
    if (isCurrentPlan) {
      return (
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 text-center">
          Current Plan
        </p>
      );
    }

    // Unauthenticated: redirect to login
    if (!isAuthenticated) {
      return (
        <Link
          to={`/login?redirect=/pricing`}
          className={`${ctaClass} block text-center`}
        >
          Start Free Trial
        </Link>
      );
    }

    // Authenticated, on free/null tier: start trial
    if (!currentIsPaid || isTrialing) {
      // If trialing a different tier, don't show another trial button
      if (isTrialing && !isCurrentPlan) {
        return (
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 text-center">
            Manage Subscription
          </p>
        );
      }

      return (
        <button
          type="button"
          className={`${ctaClass} ${loading ? disabledClass : ''}`}
          disabled={loading}
          onClick={() => onStartTrial(plan.tier as 'pro' | 'elite', interval)}
        >
          Start Free Trial
        </button>
      );
    }

    // Authenticated, already subscribed to a different paid tier
    return (
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 text-center">
        Manage Subscription
      </p>
    );
  };

  return (
    <div className={cardClass}>
      <h3 className="text-xl serif font-light italic">{plan.name}</h3>
      {renderPrice()}
      <ul className="space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-ink/60">
            <Check className="w-4 h-4 text-ink/30 mt-0.5 shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="pt-2">{renderCTA()}</div>
    </div>
  );
};

export default PlanCard;
