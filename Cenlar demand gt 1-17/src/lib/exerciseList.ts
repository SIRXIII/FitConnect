export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

export interface ExerciseDefinition {
  key: string;
  name: string;
  muscleGroup: MuscleGroup;
}

export const EXERCISES: ExerciseDefinition[] = [
  // Chest (8)
  { key: 'bench_press', name: 'Bench Press', muscleGroup: 'chest' },
  { key: 'incline_bench_press', name: 'Incline Bench Press', muscleGroup: 'chest' },
  { key: 'dumbbell_fly', name: 'Dumbbell Fly', muscleGroup: 'chest' },
  { key: 'cable_crossover', name: 'Cable Crossover', muscleGroup: 'chest' },
  { key: 'push_up', name: 'Push Up', muscleGroup: 'chest' },
  { key: 'chest_dip', name: 'Chest Dip', muscleGroup: 'chest' },
  { key: 'decline_bench_press', name: 'Decline Bench Press', muscleGroup: 'chest' },
  { key: 'dumbbell_bench_press', name: 'Dumbbell Bench Press', muscleGroup: 'chest' },

  // Back (9)
  { key: 'deadlift', name: 'Deadlift', muscleGroup: 'back' },
  { key: 'barbell_row', name: 'Barbell Row', muscleGroup: 'back' },
  { key: 'pull_up', name: 'Pull Up', muscleGroup: 'back' },
  { key: 'lat_pulldown', name: 'Lat Pulldown', muscleGroup: 'back' },
  { key: 'seated_cable_row', name: 'Seated Cable Row', muscleGroup: 'back' },
  { key: 't_bar_row', name: 'T-Bar Row', muscleGroup: 'back' },
  { key: 'face_pull', name: 'Face Pull', muscleGroup: 'back' },
  { key: 'dumbbell_row', name: 'Dumbbell Row', muscleGroup: 'back' },
  { key: 'chin_up', name: 'Chin Up', muscleGroup: 'back' },

  // Legs (10)
  { key: 'squat', name: 'Squat', muscleGroup: 'legs' },
  { key: 'leg_press', name: 'Leg Press', muscleGroup: 'legs' },
  { key: 'romanian_deadlift', name: 'Romanian Deadlift', muscleGroup: 'legs' },
  { key: 'lunge', name: 'Lunge', muscleGroup: 'legs' },
  { key: 'leg_curl', name: 'Leg Curl', muscleGroup: 'legs' },
  { key: 'leg_extension', name: 'Leg Extension', muscleGroup: 'legs' },
  { key: 'calf_raise', name: 'Calf Raise', muscleGroup: 'legs' },
  { key: 'goblet_squat', name: 'Goblet Squat', muscleGroup: 'legs' },
  { key: 'hip_thrust', name: 'Hip Thrust', muscleGroup: 'legs' },
  { key: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', muscleGroup: 'legs' },

  // Shoulders (7)
  { key: 'overhead_press', name: 'Overhead Press', muscleGroup: 'shoulders' },
  { key: 'lateral_raise', name: 'Lateral Raise', muscleGroup: 'shoulders' },
  { key: 'front_raise', name: 'Front Raise', muscleGroup: 'shoulders' },
  { key: 'reverse_fly', name: 'Reverse Fly', muscleGroup: 'shoulders' },
  { key: 'arnold_press', name: 'Arnold Press', muscleGroup: 'shoulders' },
  { key: 'upright_row', name: 'Upright Row', muscleGroup: 'shoulders' },
  { key: 'shrug', name: 'Shrug', muscleGroup: 'shoulders' },

  // Arms (9)
  { key: 'bicep_curl', name: 'Bicep Curl', muscleGroup: 'arms' },
  { key: 'hammer_curl', name: 'Hammer Curl', muscleGroup: 'arms' },
  { key: 'tricep_pushdown', name: 'Tricep Pushdown', muscleGroup: 'arms' },
  { key: 'skull_crusher', name: 'Skull Crusher', muscleGroup: 'arms' },
  { key: 'preacher_curl', name: 'Preacher Curl', muscleGroup: 'arms' },
  { key: 'concentration_curl', name: 'Concentration Curl', muscleGroup: 'arms' },
  { key: 'tricep_dip', name: 'Tricep Dip', muscleGroup: 'arms' },
  { key: 'overhead_tricep_extension', name: 'Overhead Tricep Extension', muscleGroup: 'arms' },
  { key: 'cable_curl', name: 'Cable Curl', muscleGroup: 'arms' },

  // Core (7)
  { key: 'plank', name: 'Plank', muscleGroup: 'core' },
  { key: 'crunch', name: 'Crunch', muscleGroup: 'core' },
  { key: 'russian_twist', name: 'Russian Twist', muscleGroup: 'core' },
  { key: 'hanging_leg_raise', name: 'Hanging Leg Raise', muscleGroup: 'core' },
  { key: 'ab_wheel_rollout', name: 'Ab Wheel Rollout', muscleGroup: 'core' },
  { key: 'cable_woodchop', name: 'Cable Woodchop', muscleGroup: 'core' },
  { key: 'dead_bug', name: 'Dead Bug', muscleGroup: 'core' },
];

/**
 * Search exercises by name (case-insensitive substring match).
 * Returns all exercises when query is empty.
 */
export function searchExercises(query: string): ExerciseDefinition[] {
  if (!query.trim()) return EXERCISES;
  const lower = query.toLowerCase();
  return EXERCISES.filter((e) => e.name.toLowerCase().includes(lower));
}

/**
 * Retrieve a single exercise by its key.
 */
export function getExerciseByKey(key: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.key === key);
}
