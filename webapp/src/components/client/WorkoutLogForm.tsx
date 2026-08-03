import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { searchExercises } from '@/lib/exerciseList';
import ExerciseDiagram from '@/components/shared/ExerciseDiagram';

// ─── Local form types ──────────────────────────────────────────────────────────

interface SetFormEntry {
  reps: number | '';
  weight: number | '';
  unit: 'lbs' | 'kg';
}

interface ExerciseFormEntry {
  tempId: string;
  exerciseName: string;
  exerciseKey: string | null;
  muscleGroup: string;
  sets: SetFormEntry[];
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WorkoutLogFormProps {
  userId: string;
  bookingId?: string;
  onSaved: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const WorkoutLogForm: React.FC<WorkoutLogFormProps> = ({ userId, bookingId, onSaved }) => {
  const [exercises, setExercises] = useState<ExerciseFormEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const searchResults = searchExercises(searchQuery);

  function addExercise(name: string, key: string | null, muscleGroup: string) {
    const entry: ExerciseFormEntry = {
      tempId: `${Date.now()}-${Math.random()}`,
      exerciseName: name,
      exerciseKey: key,
      muscleGroup,
      sets: [{ reps: '', weight: '', unit: weightUnit }],
    };
    setExercises(prev => [...prev, entry]);
    setShowExercisePicker(false);
    setSearchQuery('');
    setShowCustomInput(false);
    setCustomExerciseName('');
  }

  function removeExercise(tempId: string) {
    setExercises(prev => prev.filter(e => e.tempId !== tempId));
  }

  function addSet(tempId: string) {
    setExercises(prev =>
      prev.map(e =>
        e.tempId === tempId
          ? { ...e, sets: [...e.sets, { reps: '', weight: '', unit: weightUnit }] }
          : e
      )
    );
  }

  function removeSet(tempId: string, setIndex: number) {
    setExercises(prev =>
      prev.map(e =>
        e.tempId === tempId
          ? { ...e, sets: e.sets.filter((_, i) => i !== setIndex) }
          : e
      )
    );
  }

  function updateSet(tempId: string, setIndex: number, field: 'reps' | 'weight', value: string) {
    const parsed = field === 'reps' ? parseInt(value, 10) : parseFloat(value);
    const finalValue: number | '' = value === '' ? '' : isNaN(parsed) ? '' : parsed;
    setExercises(prev =>
      prev.map(e =>
        e.tempId === tempId
          ? {
              ...e,
              sets: e.sets.map((s, i) =>
                i === setIndex ? { ...s, [field]: finalValue } : s
              ),
            }
          : e
      )
    );
  }

  function addCustomExercise() {
    if (!customExerciseName.trim()) return;
    addExercise(customExerciseName.trim(), null, 'core');
  }

  async function handleSave() {
    const hasValidSet = exercises.some(ex =>
      ex.sets.some(s => typeof s.reps === 'number' && s.reps > 0)
    );

    if (exercises.length === 0 || !hasValidSet) {
      toast.error('Add at least one exercise with one set (reps > 0)');
      return;
    }

    setSaving(true);
    try {
      // Insert workout log
      const { data: logData, error: logError } = await (supabase as any)
        .from('workout_logs')
        .insert({
          client_id: userId,
          booking_id: bookingId ?? null,
          logged_at: new Date().toISOString(),
          notes: notes.trim() || null,
        })
        .select('id')
        .single();

      if (logError || !logData?.id) {
        throw logError ?? new Error('No log id returned');
      }

      const logId: string = logData.id;

      // Insert exercises
      const exerciseRows = exercises.map((ex, sortOrder) => ({
        log_id: logId,
        exercise_name: ex.exerciseName,
        exercise_key: ex.exerciseKey,
        sort_order: sortOrder,
        sets: ex.sets.map(s => ({
          reps: typeof s.reps === 'number' ? s.reps : 0,
          weight: typeof s.weight === 'number' ? s.weight : 0,
          unit: weightUnit,
        })),
      }));

      const { error: exError } = await (supabase as any)
        .from('workout_exercises')
        .insert(exerciseRows);

      if (exError) throw exError;

      toast.success('Workout logged!');
      onSaved();
    } catch {
      toast.error('Failed to save workout');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-ink/10 rounded-lg p-6 space-y-6 bg-paper">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-[0.2em] text-ink/60 font-medium">
          Log Workout
        </h3>
      </div>

      {/* Exercise list */}
      <AnimatePresence initial={false}>
        {exercises.map((ex) => (
          <motion.div
            key={ex.tempId}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border border-ink/10 rounded-lg p-4 space-y-3"
          >
            {/* Exercise header */}
            <div className="flex items-center gap-3">
              <ExerciseDiagram
                exerciseKey={ex.exerciseKey}
                muscleGroup={ex.muscleGroup}
                size={40}
                className="shrink-0 rounded"
              />
              <span className="flex-1 text-sm text-ink font-medium">{ex.exerciseName}</span>
              <button
                type="button"
                onClick={() => removeExercise(ex.tempId)}
                className="text-ink/30 hover:text-red-400 transition-colors"
                aria-label="Remove exercise"
              >
                <X size={14} />
              </button>
            </div>

            {/* Set rows */}
            <div className="space-y-2">
              {ex.sets.map((set, si) => (
                <div key={si} className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-ink/30 w-8 shrink-0">
                    Set {si + 1}
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Reps"
                    value={set.reps}
                    onChange={e => updateSet(ex.tempId, si, 'reps', e.target.value)}
                    className="w-20 border border-ink/15 rounded px-2 py-1.5 text-sm text-ink bg-transparent focus:outline-none focus:border-accent/40"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Weight"
                    value={set.weight}
                    onChange={e => updateSet(ex.tempId, si, 'weight', e.target.value)}
                    className="w-24 border border-ink/15 rounded px-2 py-1.5 text-sm text-ink bg-transparent focus:outline-none focus:border-accent/40"
                  />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-ink/40 w-6 shrink-0">
                    {weightUnit}
                  </span>
                  {ex.sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(ex.tempId, si)}
                      className="text-ink/20 hover:text-red-400 transition-colors ml-1"
                      aria-label="Remove set"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Set */}
            <button
              type="button"
              onClick={() => addSet(ex.tempId)}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-accent/60 hover:text-accent transition-colors"
            >
              <Plus size={12} />
              Add Set
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Exercise picker trigger */}
      {!showExercisePicker && (
        <button
          type="button"
          onClick={() => setShowExercisePicker(true)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-ink/20 rounded-lg py-3 text-[11px] uppercase tracking-[0.2em] text-ink/40 hover:border-accent/40 hover:text-accent transition-colors"
        >
          <Plus size={14} />
          Add Exercise
        </button>
      )}

      {/* Exercise picker panel */}
      <AnimatePresence>
        {showExercisePicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-ink/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  className="flex-1 border border-ink/15 rounded px-3 py-2 text-sm text-ink bg-transparent focus:outline-none focus:border-accent/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowExercisePicker(false);
                    setSearchQuery('');
                    setShowCustomInput(false);
                  }}
                  className="text-ink/30 hover:text-ink/60 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.slice(0, 20).map(ex => (
                  <button
                    key={ex.key}
                    type="button"
                    onClick={() => addExercise(ex.name, ex.key, ex.muscleGroup)}
                    className="w-full flex items-center gap-3 px-2 py-2 text-left rounded hover:bg-accent/5 transition-colors"
                  >
                    <ExerciseDiagram
                      exerciseKey={ex.key}
                      muscleGroup={ex.muscleGroup}
                      size={32}
                      className="shrink-0 rounded"
                    />
                    <div>
                      <p className="text-sm text-ink">{ex.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-ink/30 capitalize">
                        {ex.muscleGroup}
                      </p>
                    </div>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <p className="text-sm text-ink/30 px-2 py-3 text-center">No matches found</p>
                )}
              </div>

              {/* Custom exercise */}
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-ink/40 hover:text-accent transition-colors pt-1"
                >
                  <Plus size={12} />
                  Add Custom Exercise
                </button>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Exercise name..."
                    value={customExerciseName}
                    onChange={e => setCustomExerciseName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomExercise(); }}
                    autoFocus
                    className="flex-1 border border-ink/15 rounded px-3 py-1.5 text-sm text-ink bg-transparent focus:outline-none focus:border-accent/40"
                  />
                  <button
                    type="button"
                    onClick={addCustomExercise}
                    disabled={!customExerciseName.trim()}
                    className="text-[10px] uppercase tracking-[0.15em] border border-accent/30 px-3 py-1.5 text-accent hover:bg-accent hover:text-white transition-all disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Session notes (optional)"
        rows={2}
        className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm text-ink bg-transparent focus:outline-none focus:border-accent/40 resize-none"
      />

      {/* Bottom row: unit toggle + save */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setWeightUnit(u => u === 'lbs' ? 'kg' : 'lbs')}
          className="text-[11px] uppercase tracking-[0.2em] border border-ink/15 px-4 py-2 text-ink/50 hover:border-accent/40 hover:text-accent transition-colors"
        >
          {weightUnit}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] border border-accent/40 px-6 py-2.5 text-accent hover:bg-accent hover:text-white transition-all disabled:opacity-50"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save Workout
        </button>
      </div>
    </div>
  );
};

export default WorkoutLogForm;
