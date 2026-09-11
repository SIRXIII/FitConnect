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

export interface SessionEntry {
  id: string;
  notes: string | null;
  exercises: { name: string; sets: number; reps: number }[];
  slot_start: string | null;
  slot_end: string | null;
  trainer_name: string | null;
}
