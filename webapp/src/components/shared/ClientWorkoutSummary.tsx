import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Dumbbell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ExerciseDiagram from '@/components/shared/ExerciseDiagram';
import { formatSet } from '@/lib/workoutUtils';
import type { WorkoutLogWithExercises } from '@/types/workout';

interface ClientWorkoutSummaryProps {
  clientId: string;
  title?: string;
}

export default function ClientWorkoutSummary({
  clientId,
  title = 'Recent Workouts',
}: ClientWorkoutSummaryProps) {
  const [logs, setLogs] = useState<WorkoutLogWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('workout_logs')
        .select('*, workout_exercises(*)')
        .eq('client_id', clientId)
        .order('logged_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setLogs((data as WorkoutLogWithExercises[]) ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function toggleLog(logId: string) {
    setExpandedLogId((prev) => (prev === logId ? null : logId));
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Dumbbell size={14} className="text-ink/40" />
        <h3 className="text-[10px] uppercase tracking-[0.25em] text-ink/40">{title}</h3>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-ink/40">
          <div className="w-3 h-3 border border-ink/20 border-t-transparent rounded-full animate-spin" />
          Loading workout history...
        </div>
      )}

      {/* Empty */}
      {!loading && logs.length === 0 && (
        <p className="text-sm text-ink/30 italic py-2">No workout logs yet.</p>
      )}

      {/* Log list */}
      {!loading && logs.length > 0 && (
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const exerciseCount = log.workout_exercises?.length ?? 0;
            const notesPreview = log.notes && log.notes.trim().length > 0
              ? log.notes.trim().slice(0, 60) + (log.notes.trim().length > 60 ? '...' : '')
              : null;
            const sortedExercises = [...(log.workout_exercises ?? [])].sort(
              (a, b) => a.sort_order - b.sort_order
            );

            return (
              <div
                key={log.id}
                className="border border-ink/10 rounded-lg overflow-hidden"
              >
                {/* Card header (clickable) */}
                <button
                  type="button"
                  onClick={() => toggleLog(log.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink/5 transition-colors text-left"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-ink/80">{formatDate(log.logged_at)}</p>
                    <p className="text-[11px] text-ink/40">
                      {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                    </p>
                    {notesPreview && (
                      <p className="text-[11px] text-ink/30 italic">{notesPreview}</p>
                    )}
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 ml-3"
                  >
                    <ChevronDown size={14} className="text-ink/30" />
                  </motion.div>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      key={`expanded-${log.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gray-50 border-t border-ink/10 px-4 py-3 space-y-3">
                        {/* Exercises */}
                        {sortedExercises.length > 0 && (
                          <div className="space-y-2">
                            {sortedExercises.map((exercise) => (
                              <div key={exercise.id} className="flex items-start gap-3">
                                <ExerciseDiagram
                                  exerciseKey={exercise.exercise_key}
                                  size={32}
                                  className="shrink-0 mt-0.5"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm text-ink/80 font-medium leading-tight">
                                    {exercise.exercise_name}
                                  </p>
                                  {exercise.sets?.length > 0 && (
                                    <p className="text-[11px] text-ink/40 mt-0.5">
                                      {exercise.sets.map((s) => formatSet(s)).join(' | ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Full notes */}
                        {log.notes && log.notes.trim().length > 0 && (
                          <p className="text-sm text-ink/50 italic leading-relaxed border-t border-ink/10 pt-3">
                            {log.notes.trim()}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
