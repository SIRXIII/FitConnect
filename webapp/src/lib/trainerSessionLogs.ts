import { supabase } from '@/lib/supabase';
import { convertWeight } from '@/lib/workoutUtils';
import type { SetEntry, TrainerWorkoutLog, WorkoutExerciseRow } from '@/types/workout';
import type { SessionEntry } from '@/types/session';

interface TrainerExerciseSetRow {
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}
interface TrainerSessionExerciseRow {
  id: string;
  exercise_name: string;
  exercise_key: string | null;
  sort_order: number;
  trainer_exercise_sets: TrainerExerciseSetRow[];
}
interface TrainerProfileEmbed {
  profiles: { full_name: string } | { full_name: string }[] | null;
}
interface TrainerSessionLogRow {
  id: string;
  booking_id: string | null;
  client_id: string;
  session_date: string;
  session_notes: string | null;
  created_at: string;
  trainer_session_exercises: TrainerSessionExerciseRow[];
  trainer_profiles: TrainerProfileEmbed | TrainerProfileEmbed[] | null;
}

export async function fetchTrainerSessionLogs(userId: string): Promise<TrainerSessionLogRow[]> {
  const { data, error } = await (supabase as any)
    .from('trainer_session_logs')
    .select(
      '*, trainer_session_exercises(*, trainer_exercise_sets(*)), trainer_profiles!trainer_session_logs_trainer_id_fkey(profiles!trainer_profiles_user_id_fkey(full_name))'
    )
    .eq('client_id', userId)
    .order('session_date', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as unknown as TrainerSessionLogRow[];
}

// session_date is a DATE-only string (e.g. "2026-09-02"). `new Date(str)` parses that as
// UTC midnight, which renders as the previous day in Pacific. Build local midnight instead.
function dateOnlyToLocalISO(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

function trainerNameFromRow(row: TrainerSessionLogRow): string | null {
  const tp = Array.isArray(row.trainer_profiles) ? row.trainer_profiles[0] : row.trainer_profiles;
  const profile = Array.isArray(tp?.profiles) ? tp?.profiles[0] : tp?.profiles;
  return profile?.full_name ?? null;
}

function sortedExercises(row: TrainerSessionLogRow): TrainerSessionExerciseRow[] {
  return [...(row.trainer_session_exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export function toWorkoutLog(row: TrainerSessionLogRow): TrainerWorkoutLog {
  const workout_exercises: WorkoutExerciseRow[] = sortedExercises(row).map((ex) => {
    const sets: SetEntry[] = [...(ex.trainer_exercise_sets ?? [])]
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => ({
        reps: s.reps ?? 0,
        weight: s.weight_kg == null ? 0 : convertWeight(Number(s.weight_kg), 'kg', 'lbs'),
        unit: 'lbs' as const,
      }));
    return {
      id: ex.id,
      log_id: row.id,
      exercise_name: ex.exercise_name,
      exercise_key: ex.exercise_key,
      sort_order: ex.sort_order,
      sets,
    };
  });

  return {
    id: row.id,
    client_id: row.client_id,
    booking_id: row.booking_id,
    created_at: row.created_at,
    logged_at: dateOnlyToLocalISO(row.session_date),
    notes: row.session_notes,
    trainer_name: trainerNameFromRow(row),
    workout_exercises,
  };
}

export function toSessionEntry(row: TrainerSessionLogRow): SessionEntry {
  const exercises = sortedExercises(row).map((ex) => {
    const sets = ex.trainer_exercise_sets ?? [];
    return { name: ex.exercise_name, sets: sets.length, reps: Math.max(0, ...sets.map((s) => s.reps ?? 0)) };
  });

  return {
    id: row.id,
    notes: row.session_notes,
    exercises,
    slot_start: dateOnlyToLocalISO(row.session_date),
    slot_end: null,
    trainer_name: trainerNameFromRow(row),
  };
}
