import { motion, AnimatePresence } from 'framer-motion';

interface SleepTimerPillsProps {
  selectedDuration: number | 'eod' | null;
  onSelect: (duration: number | 'eod') => void;
  visible: boolean;
}

const PILLS: { label: string; value: number | 'eod' }[] = [
  { label: '1hr', value: 1 },
  { label: '2hr', value: 2 },
  { label: '4hr', value: 4 },
  { label: 'EOD', value: 'eod' },
];

const base = 'px-5 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-200 rounded-full border';

const SleepTimerPills: React.FC<SleepTimerPillsProps> = ({
  selectedDuration,
  onSelect,
  visible,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="group"
          aria-label="Sleep timer duration"
          className="flex items-center gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {PILLS.map((pill) => {
            const isSelected = selectedDuration === pill.value;
            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => onSelect(pill.value)}
                className={`${base} ${
                  isSelected
                    ? 'bg-white text-stone-950 border-white/80 shadow-sm shadow-white/10'
                    : 'text-stone-400 border-stone-600/40 hover:text-white hover:border-stone-400/60'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SleepTimerPills;
