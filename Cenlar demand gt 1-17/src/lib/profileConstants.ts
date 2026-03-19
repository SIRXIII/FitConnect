// Shared profile constants — used across ClientPassport, ClientOnboarding,
// GoalRankPicker, HealthConditionPicker, and Zod schema validation.

// Fitness goals with labels
export const FITNESS_GOALS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Build Muscle' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'sports_performance', label: 'Sports Performance' },
] as const;

export const WORKOUT_TYPES = [
  { value: 'strength_training', label: 'Strength Training' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'martial_arts', label: 'Martial Arts' },
  { value: 'dance', label: 'Dance' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'calisthenics', label: 'Calisthenics' },
] as const;

export const FREQUENCIES = [
  { value: '1-2', label: '1-2x/week' },
  { value: '3-4', label: '3-4x/week' },
  { value: '5-6', label: '5-6x/week' },
  { value: '7+', label: '7+/week' },
] as const;

// Phase 23.1: New constants for client profile enhancement

export const HEALTH_CONDITIONS = [
  { value: 'back_pain', label: 'Back Pain' },
  { value: 'knee_injury', label: 'Knee Injury' },
  { value: 'asthma', label: 'Asthma' },
  { value: 'heart_condition', label: 'Heart Condition' },
  { value: 'pregnancy', label: 'Pregnancy' },
  { value: 'diabetes', label: 'Diabetes' },
] as const;

export const INTENSITY_LEVELS = [
  { value: 'light', label: 'Light', desc: 'Focus on form and mobility', color: 'text-green-600 border-green-400 bg-green-50' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced effort and challenge', color: 'text-amber-500 border-amber-400 bg-amber-50' },
  { value: 'intense', label: 'Intense', desc: 'Push limits and max output', color: 'text-red-500 border-red-400 bg-red-50' },
] as const;

// Value-only arrays for Zod enum validation
export const HEALTH_CONDITION_VALUES = HEALTH_CONDITIONS.map(c => c.value) as unknown as readonly [string, ...string[]];
export const INTENSITY_LEVEL_VALUES = ['light', 'moderate', 'intense'] as const;
export const FITNESS_GOAL_VALUES = FITNESS_GOALS.map(g => g.value) as unknown as readonly [string, ...string[]];
