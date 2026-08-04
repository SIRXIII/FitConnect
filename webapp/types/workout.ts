// Client-owned workout logging types.
// Separate from trainer-owned session logs in src/types/session.ts.

export interface SetEntry {
  reps: number;
  weight: number;
  unit: 'lbs' | 'kg';
}

export interface WorkoutExerciseRow {
  id: string;
  log_id: string;
  exercise_name: string;
  exercise_key: string | null;
  sort_order: number;
  sets: SetEntry[];
}

export interface WorkoutLogRow {
  id: string;
  client_id: string;
  booking_id: string | null;
  logged_at: string;
  notes: string | null;
  created_at: string;
}

export interface WorkoutLogWithExercises extends WorkoutLogRow {
  workout_exercises: WorkoutExerciseRow[];
}
