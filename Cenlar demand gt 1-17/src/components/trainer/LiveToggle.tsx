import { motion, AnimatePresence } from 'framer-motion';
import type { AvailabilityUIStatus } from '@/hooks/useAvailabilitySession';

interface LiveToggleProps {
  uiStatus: AvailabilityUIStatus;
  onToggle: () => void;
  onCancelWarmup: () => void;
}

const LiveToggle: React.FC<LiveToggleProps> = ({ uiStatus, onToggle, onCancelWarmup }) => {
  const handleClick = () => {
    if (uiStatus === 'going_live') {
      onCancelWarmup();
    } else {
      onToggle();
    }
  };

  const isLive = uiStatus === 'live';
  const isGoingLive = uiStatus === 'going_live';

  const bgClass = isLive
    ? 'bg-green-500'
    : isGoingLive
    ? 'bg-amber-400'
    : 'bg-ink/10';

  const labelClass = isLive
    ? 'text-white text-[10px] uppercase tracking-[0.3em] font-medium'
    : isGoingLive
    ? 'text-ink text-[10px] uppercase tracking-[0.4em] font-medium'
    : 'text-ink/40 text-[10px] uppercase tracking-[0.3em] font-medium';

  const label = isLive ? 'YOU ARE LIVE' : isGoingLive ? 'GOING LIVE...' : 'OFFLINE';

  const ariaLabel = isLive ? 'Go offline' : 'Go live';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isLive}
      aria-label={ariaLabel}
      className={`relative overflow-hidden min-h-[44px] px-6 rounded-full cursor-pointer transition-colors duration-200 flex items-center justify-center ${bgClass}`}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={uiStatus}
          className={labelClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            uiStatus === 'live'
              ? { duration: 0.2, ease: 'easeOut' }
              : { duration: 0.15, ease: 'easeIn' }
          }
        >
          {label}
        </motion.span>
      </AnimatePresence>

      {/* Warm-up progress bar — fills left to right over 5 seconds */}
      {isGoingLive && (
        <motion.div
          className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-600 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 5, ease: 'linear' }}
        />
      )}
    </button>
  );
};

export default LiveToggle;
