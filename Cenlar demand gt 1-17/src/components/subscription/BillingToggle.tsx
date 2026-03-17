import type { BillingInterval } from '@/lib/subscription';

interface BillingToggleProps {
  interval: BillingInterval;
  onToggle: (interval: BillingInterval) => void;
}

export const BillingToggle: React.FC<BillingToggleProps> = ({ interval, onToggle }) => {
  const base = 'px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-medium transition-colors';

  return (
    <div className="flex items-center gap-4">
      <div className="flex">
        <button
          type="button"
          className={`${base} ${interval === 'month' ? 'bg-ink text-white' : 'text-ink/40 hover:text-ink'}`}
          onClick={() => onToggle('month')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`${base} ${interval === 'year' ? 'bg-ink text-white' : 'text-ink/40 hover:text-ink'}`}
          onClick={() => onToggle('year')}
        >
          Annual
        </button>
      </div>
      {interval === 'year' && (
        <span className="text-accent text-[10px] uppercase tracking-[0.2em] font-medium">
          Save 20%
        </span>
      )}
    </div>
  );
};

export default BillingToggle;
