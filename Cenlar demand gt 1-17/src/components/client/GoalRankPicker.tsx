import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { FITNESS_GOALS } from '@/lib/profileConstants';

interface GoalRankPickerProps {
  ranked: string[]; // ordered goal values, max 3
  onChange: (ranked: string[]) => void;
}

const GoalRankPicker: React.FC<GoalRankPickerProps> = ({ ranked, onChange }) => {
  const getLabel = (value: string) =>
    FITNESS_GOALS.find(g => g.value === value)?.label ?? value;

  const pool = FITNESS_GOALS.filter(g => !ranked.includes(g.value));
  const isFull = ranked.length >= 3;

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...ranked];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === ranked.length - 1) return;
    const next = [...ranked];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    const next = ranked.filter((_, i) => i !== index);
    onChange(next);
  };

  const add = (value: string) => {
    if (isFull) return;
    onChange([...ranked, value]);
  };

  return (
    <div className="space-y-4">
      {/* Ranked list */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Your Top 3</p>
        {ranked.length === 0 && (
          <p className="text-xs text-ink/30 font-light py-3">
            Select goals below to rank them
          </p>
        )}
        <AnimatePresence>
          {ranked.map((value, index) => (
            <motion.div
              key={value}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 border border-accent bg-accent/5 p-3"
            >
              <span className="text-accent text-sm font-medium w-5 shrink-0">
                {index + 1}
              </span>
              <span className="flex-1 text-[11px] uppercase tracking-[0.1em] text-accent font-medium">
                {getLabel(value)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="p-1 text-accent/60 hover:text-accent disabled:opacity-20 transition-colors"
                  aria-label="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={index === ranked.length - 1}
                  className="p-1 text-accent/60 hover:text-accent disabled:opacity-20 transition-colors"
                  aria-label="Move down"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 text-accent/40 hover:text-red-500 transition-colors"
                  aria-label="Remove goal"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Available pool */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Available Goals</p>
        <div className="grid grid-cols-2 gap-2">
          {pool.map((goal) => (
            <button
              key={goal.value}
              type="button"
              onClick={() => add(goal.value)}
              disabled={isFull}
              className={`text-left py-3 px-4 border text-[11px] uppercase tracking-[0.1em] font-medium transition-all ${
                isFull
                  ? 'border-ink/10 text-ink/30 opacity-40 cursor-not-allowed'
                  : 'border-ink/10 text-ink/60 hover:border-ink/30'
              }`}
            >
              {goal.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GoalRankPicker;
