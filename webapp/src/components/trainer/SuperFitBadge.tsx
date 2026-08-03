import { Flame } from 'lucide-react';
import { useSuperFitBadge } from '@/hooks/useSuperFitBadge';

interface SuperFitBadgeProps {
  trainerId: string;
}

/** Pill shown when a trainer holds an active (non-revoked) SuperFit badge. */
export const SuperFitBadge: React.FC<SuperFitBadgeProps> = ({ trainerId }) => {
  const { hasBadge } = useSuperFitBadge(trainerId);
  if (!hasBadge) return null;

  return (
    <div className="inline-flex items-center gap-1.5 border border-accent/40 text-accent px-3 py-1 rounded-full mr-4">
      <Flame size={11} />
      <span className="text-[10px] uppercase tracking-[0.15em] font-medium">SuperFit</span>
    </div>
  );
};

export default SuperFitBadge;
