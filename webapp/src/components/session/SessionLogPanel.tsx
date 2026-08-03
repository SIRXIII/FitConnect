import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Lock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { ExerciseEntry } from '@/types/session';

interface SessionLogPanelProps {
  bookingId: string;
  trainerId: string;
  clientId: string;
  slotEndTime: string | null;
  expanded: boolean;
  onToggle: () => void;
}

const SessionLogPanel: React.FC<SessionLogPanelProps> = ({
  bookingId,
  trainerId,
  clientId,
  slotEndTime,
  expanded,
  onToggle,
}) => {
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [logExists, setLogExists] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);

  // New exercise input state
  const [newName, setNewName] = useState('');
  const [newSets, setNewSets] = useState('');
  const [newReps, setNewReps] = useState('');

  // 24-hour lock: computed from slot end time
  const isLocked = slotEndTime
    ? new Date(slotEndTime).getTime() + 86400000 < Date.now()
    : false;

  // Expand button label
  const expandLabel = logExists
    ? isLocked
      ? 'View session notes'
      : 'Edit session notes'
    : 'Add session notes';

  // Load existing session log on mount
  useEffect(() => {
    const fetchLog = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('session_logs')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (data) {
        setLogExists(true);
        setNotes(data.notes ?? '');
        setExercises((data.exercises as ExerciseEntry[]) ?? []);
      }
    };

    fetchLog();
  }, [bookingId]);

  // Auto-save notes on blur
  const handleNotesBlur = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('session_logs')
      .upsert(
        {
          booking_id: bookingId,
          trainer_id: trainerId,
          client_id: clientId,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'booking_id' }
      );

    if (!error) {
      setLogExists(true);
      toast.success('Notes saved.', { duration: 2000, id: 'session-notes-save' });
    } else {
      toast.error("Couldn't save — check your connection and try again.");
    }
  };

  // Add exercise to the list
  const handleAddExercise = () => {
    const name = newName.trim();
    const sets = parseInt(newSets, 10);
    const reps = parseInt(newReps, 10);

    if (!name || !(sets > 0) || !(reps > 0)) return;

    const entry: ExerciseEntry = { name, sets, reps };
    setExercises((prev) => [...prev, entry]);
    setNewName('');
    setNewSets('');
    setNewReps('');
  };

  // Remove exercise by index
  const handleRemoveExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  // Save workout (full exercises array upsert)
  const handleSaveWorkout = async () => {
    setSavingWorkout(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('session_logs')
      .upsert(
        {
          booking_id: bookingId,
          trainer_id: trainerId,
          client_id: clientId,
          exercises,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'booking_id' }
      );

    setSavingWorkout(false);

    if (!error) {
      setLogExists(true);
      toast.success('Workout saved.', { duration: 2000, id: 'session-workout-save' });
    } else {
      toast.error("Couldn't save — check your connection and try again.");
    }
  };

  return (
    <div className="border-t border-ink/5 pt-4">
      {/* Expand/collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink/40 hover:text-ink/70 transition-colors"
      >
        {isLocked ? (
          <Lock size={12} />
        ) : (
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        )}
        {expandLabel}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="session-log-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-6">

              {/* ---- Session Notes ---- */}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Session Notes</p>

                {isLocked ? (
                  <div className="space-y-1">
                    <p className="text-sm text-ink/60">{notes || <span className="italic text-ink/30">No notes recorded.</span>}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Lock size={10} className="text-ink/30" />
                      <p className="text-xs text-ink/30">Editing closed 24 hours after the session.</p>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    placeholder="Write session notes here..."
                    className="w-full border border-ink/10 bg-paper p-4 text-sm resize-none min-h-[96px] focus:outline-none focus:border-ink/30 transition-colors"
                  />
                )}
              </div>

              {/* ---- Workout Log ---- */}
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Workout Log</p>

                {exercises.length === 0 && (
                  <p className="text-xs text-ink/30 italic">No exercises logged yet.</p>
                )}

                <AnimatePresence>
                  {exercises.map((ex, index) => (
                    <motion.div
                      key={`${ex.name}-${index}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex gap-2 items-center"
                    >
                      {isLocked ? (
                        <p className="text-sm text-ink/70 flex-1">
                          {ex.name} — {ex.sets} × {ex.reps}
                        </p>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={ex.name}
                            onChange={(e) =>
                              setExercises((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, name: e.target.value } : item
                                )
                              )
                            }
                            className="border-b border-ink/10 bg-transparent px-0 py-1 text-sm focus:outline-none focus:border-ink/30 flex-1"
                          />
                          <input
                            type="number"
                            value={ex.sets}
                            min={1}
                            onChange={(e) =>
                              setExercises((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, sets: parseInt(e.target.value, 10) || 0 } : item
                                )
                              )
                            }
                            className="border border-ink/10 text-center w-16 h-9 text-sm bg-paper focus:outline-none focus:border-ink/30"
                          />
                          <span className="text-ink/30 text-xs">×</span>
                          <input
                            type="number"
                            value={ex.reps}
                            min={1}
                            onChange={(e) =>
                              setExercises((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, reps: parseInt(e.target.value, 10) || 0 } : item
                                )
                              )
                            }
                            className="border border-ink/10 text-center w-16 h-9 text-sm bg-paper focus:outline-none focus:border-ink/30"
                          />
                          <button
                            onClick={() => handleRemoveExercise(index)}
                            aria-label="Remove exercise"
                            className="text-ink/30 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add new exercise row */}
                {!isLocked && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Exercise name"
                      className="border-b border-ink/10 bg-transparent px-0 py-1 text-sm focus:outline-none focus:border-ink/30 flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddExercise();
                      }}
                    />
                    <input
                      type="number"
                      value={newSets}
                      onChange={(e) => setNewSets(e.target.value)}
                      placeholder="Sets"
                      min={1}
                      className="border border-ink/10 text-center w-16 h-9 text-sm bg-paper focus:outline-none focus:border-ink/30"
                    />
                    <span className="text-ink/30 text-xs">×</span>
                    <input
                      type="number"
                      value={newReps}
                      onChange={(e) => setNewReps(e.target.value)}
                      placeholder="Reps"
                      min={1}
                      className="border border-ink/10 text-center w-16 h-9 text-sm bg-paper focus:outline-none focus:border-ink/30"
                    />
                    <div className="w-[14px]" />
                  </div>
                )}

                {!isLocked && (
                  <button
                    onClick={handleAddExercise}
                    className="flex items-center gap-1 text-xs text-ink/40 hover:text-ink/70 mt-2 transition-colors"
                  >
                    <Plus size={12} />
                    Add exercise
                  </button>
                )}

                {/* Save workout button */}
                {!isLocked && exercises.length > 0 && (
                  <button
                    onClick={handleSaveWorkout}
                    disabled={savingWorkout}
                    className="border border-accent text-accent text-xs uppercase tracking-[0.2em] px-4 py-2 hover:bg-accent/5 transition-colors disabled:opacity-50"
                  >
                    {savingWorkout ? 'Saving...' : 'Save workout'}
                  </button>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SessionLogPanel;
