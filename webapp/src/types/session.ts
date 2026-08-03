export interface ExerciseEntry {
  name: string;
  sets: number;
  reps: number;
}

export interface SessionLog {
  id: string;
  booking_id: string;
  trainer_id: string;
  client_id: string;
  notes: string | null;
  exercises: ExerciseEntry[];
  created_at: string;
  updated_at: string;
}
