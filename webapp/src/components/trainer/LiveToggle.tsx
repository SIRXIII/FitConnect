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
    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
    : isGoingLive
    ? 'bg-amber-500 shadow-md shadow-amber-500/25'
    : 'bg-rose-600/80 shadow-md shadow-rose-600/20 border border-rose-500/40';

  const labelClass = isLive
    ? 'text-white text-[10px] uppercase tracking-[0.3em] font-semibold'
    : isGoingLive
    ? 'text-white text-[10px] uppercase tracking-[0.4em] font-semibold'
    : 'text-rose-100 text-[10px] uppercase tracking-[0.3em] font-semibold';

  const label = isLive ? 'LIVE' : isGoingLive ? 'GOING LIVE...' : 'OFFLINE';

  const ariaLabel = isLive ? 'Go offline' : 'Go live';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isLive}
      aria-label={ariaLabel}
      className={`relative overflow-hidden min-h-[44px] px-8 rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 ${bgClass}`}
    >
      {/* Pulsing dot for live state */}
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
      )}

      {/* Static dot for offline */}
      {uiStatus === 'offline' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-300/60" />
        </span>
      )}

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

      {/* Warm-up progress bar */}
      {isGoingLive && (
        <motion.div
          className="absolute inset-x-0 bottom-0 h-0.5 bg-white/60 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 5, ease: 'linear' }}
        />
      )}
    </button>
  );
};

export default LiveToggle;
