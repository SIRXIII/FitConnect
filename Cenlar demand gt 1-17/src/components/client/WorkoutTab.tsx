import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { WorkoutLogWithExercises } from '@/types/workout';
import { formatSet } from '@/lib/workoutUtils';
import ExerciseDiagram from '@/components/shared/ExerciseDiagram';
import WorkoutLogForm from '@/components/client/WorkoutLogForm';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WorkoutTabProps {
  userId: string;
}

const PAGE_SIZE = 10;

// ─── Component ─────────────────────────────────────────────────────────────────

const WorkoutTab: React.FC<WorkoutTabProps> = ({ userId }) => {
  const [logs, setLogs] = useState<WorkoutLogWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('workout_logs')
          .select('*, workout_exercises(*)')
          .eq('client_id', userId)
          .order('logged_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as WorkoutLogWithExercises[];

        if (pageNum === 0) {
          setLogs(rows);
        } else {
          setLogs(prev => [...prev, ...rows]);
        }

        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        // Silently fail — empty state will show
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  function handleSaved() {
    setShowLogForm(false);
    setPage(0);
    fetchLogs(0);
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage);
  }

  function toggleExpand(logId: string) {
    setExpandedLogId(prev => (prev === logId ? null : logId));
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl serif font-light italic text-ink">Workouts</h2>
        <button
          type="button"
          onClick={() => setShowLogForm(v => !v)}
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] border border-accent/30 px-5 py-2.5 text-accent hover:bg-accent hover:text-white transition-all"
        >
          <Dumbbell size={13} />
          Log Workout
        </button>
      </div>

      {/* Log form */}
      <AnimatePresence>
        {showLogForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <WorkoutLogForm
              userId={userId}
              onSaved={handleSaved}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && logs.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Dumbbell size={32} className="mx-auto text-ink/15" />
          <p className="text-sm text-ink/40 font-light">
            No workouts logged yet. Start by tapping &apos;Log Workout&apos;.
          </p>
        </div>
      )}

      {/* Log list */}
      {logs.length > 0 && (
        <div className="space-y-3">
          {logs.map(log => {
            const isExpanded = expandedLogId === log.id;
            const exerciseCount = log.workout_exercises.length;

            return (
              <div
                key={log.id}
                className="border border-ink/10 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Log card header (tap to expand) */}
                <button
                  type="button"
                  onClick={() => toggleExpand(log.id)}
                  className="w-full flex items-start gap-4 p-4 text-left hover:bg-ink/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-ink font-medium">
                        {formatDate(log.logged_at)}
                      </p>
                      <span className="text-[10px] uppercase tracking-[0.15em] text-ink/30 shrink-0">
                        {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink/40">
                      {log.booking_id ? 'Session workout' : 'Standalone workout'}
                    </p>
                    {log.notes && (
                      <p className="text-xs text-ink/40 font-light truncate max-w-xs">
                        {log.notes.length > 80 ? log.notes.slice(0, 80) + '...' : log.notes}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-ink/30 mt-0.5">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {/* Expanded accordion */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-ink/10 px-4 py-4 space-y-4">
                        {log.workout_exercises
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map(ex => (
                            <div key={ex.id} className="flex items-start gap-3">
                              <ExerciseDiagram
                                exerciseKey={ex.exercise_key}
                                size={36}
                                className="shrink-0 rounded mt-0.5"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-sm text-ink font-medium">{ex.exercise_name}</p>
                                <div className="flex flex-wrap gap-2">
                                  {(ex.sets ?? []).map((set, si) => (
                                    <span
                                      key={si}
                                      className="text-[11px] text-ink/50 border border-ink/10 rounded px-2 py-0.5"
                                    >
                                      {formatSet(set)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}

                        {log.notes && (
                          <p className="text-xs text-ink/40 italic border-t border-ink/5 pt-3">
                            {log.notes}
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

      {/* Load More */}
      {hasMore && !loading && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            className="text-[11px] uppercase tracking-[0.2em] border border-ink/15 px-8 py-3 text-ink/40 hover:border-accent/40 hover:text-accent transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {/* Inline loading indicator for additional pages */}
      {loading && logs.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default WorkoutTab;
