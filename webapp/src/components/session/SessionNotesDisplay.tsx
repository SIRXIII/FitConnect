import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ExerciseEntry } from '@/types/session';

interface SessionNotesDisplayProps {
  notes: string | null;
  exercises: ExerciseEntry[];
  expanded: boolean;
  onToggle: () => void;
}

const SessionNotesDisplay: React.FC<SessionNotesDisplayProps> = ({
  notes,
  exercises,
  expanded,
  onToggle,
}) => {
  const hasNotes = notes != null && notes.trim().length > 0;
  const hasExercises = exercises.length > 0;

  if (!hasNotes && !hasExercises) return null;

  return (
    <div className="pt-2">
      <button
        onClick={onToggle}
        className="text-xs text-ink/40 hover:text-ink/70 cursor-pointer flex items-center gap-1 transition-colors"
      >
        <span>View session notes</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="session-notes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {hasNotes && (
                <p className="text-sm text-ink leading-relaxed">{notes}</p>
              )}

              {hasExercises && (
                <div className="space-y-1 mt-2">
                  {exercises.map((entry, idx) => (
                    <p key={idx} className="text-sm text-ink/70">
                      {entry.name} \u2014 {entry.sets} \u00D7 {entry.reps}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SessionNotesDisplay;
