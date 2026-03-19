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

const base = 'px-6 py-2 text-[10px] uppercase tracking-[0.2em] font-medium transition-colors rounded-full';

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
          className="flex items-center gap-2"
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
                  isSelected ? 'bg-ink text-white' : 'text-ink/40 hover:text-ink'
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
