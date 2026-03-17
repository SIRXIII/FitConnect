import { PRICING_DATA } from '@/lib/subscription';
import type { BillingInterval } from '@/lib/subscription';
import type { Tier } from '@/lib/tierGates';
import PlanCard from './PlanCard';

interface PricingTableProps {
  interval: BillingInterval;
  currentTier: Tier | null;
  isTrialing: boolean;
  onStartTrial: (tier: 'pro' | 'elite', interval: BillingInterval) => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export const PricingTable: React.FC<PricingTableProps> = (props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {PRICING_DATA.map((plan) => (
        <PlanCard
          key={plan.tier}
          plan={plan}
          interval={props.interval}
          currentTier={props.currentTier}
          isTrialing={props.isTrialing}
          onStartTrial={props.onStartTrial}
          loading={props.loading}
          isAuthenticated={props.isAuthenticated}
        />
      ))}
    </div>
  );
};

export default PricingTable;
