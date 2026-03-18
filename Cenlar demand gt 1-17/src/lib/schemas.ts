import { z } from 'zod';

// --- Existing Schemas ---

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Please select a rating').max(5),
  comment: z.string().max(1000, 'Review must be under 1000 characters').optional(),
});

export const bookingNotesSchema = z.object({
  notes: z.string().max(500, 'Notes must be under 500 characters').optional(),
});

export const searchSchema = z.object({
  location: z.string().max(50, 'Location must be under 50 characters').optional(),
  specialty: z.string().optional(),
  priceRange: z.string().optional(),
});

// --- Phase 17: Security Hardening Schemas ---

const SPECIALTIES = [
  'strength_training',
  'cardio_hiit',
  'yoga_pilates',
  'nutrition_coaching',
  'injury_rehabilitation',
] as const;

const SUBSCRIPTION_TIERS = ['free', 'pro', 'elite'] as const;

const FITNESS_GOALS = [
  'weight_loss',
  'muscle_gain',
  'endurance',
  'flexibility',
  'general_fitness',
  'rehabilitation',
  'sports_performance',
] as const;

const WORKOUT_TYPES = [
  'strength_training',
  'cardio',
  'hiit',
  'yoga',
  'pilates',
  'swimming',
  'running',
  'cycling',
  'martial_arts',
  'dance',
  'crossfit',
  'calisthenics',
] as const;

/** Trainer profile creation/update */
export const trainerProfileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  bio: z.string().max(1000, 'Bio must be under 1000 characters').optional(),
  location: z.string().min(1, 'Location is required').max(100, 'Location must be under 100 characters'),
  specialty: z.enum(SPECIALTIES, { message: 'Please select a valid specialty' }),
  hourly_rate: z.number().min(10, 'Minimum rate is $10').max(10000, 'Maximum rate is $10,000'),
  optimized_rate: z.number().min(5, 'Minimum optimized rate is $5').max(10000, 'Maximum rate is $10,000'),
  certifications: z.array(z.string().max(50)).max(10, 'Maximum 10 certifications').optional(),
});

/** Client profile creation/update */
export const clientProfileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  age: z.number().int().min(13, 'Must be at least 13 years old').max(120, 'Please enter a valid age').optional(),
  weight_lbs: z.number().min(50, 'Please enter a valid weight').max(1000).optional(),
  height_feet: z.number().int().min(3).max(8).optional(),
  height_inches: z.number().int().min(0).max(11).optional(),
  fitness_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  health_notes: z.string().max(2000, 'Health notes must be under 2000 characters').optional(),
});

/** Fitness Passport intake form (v3.0) */
export const fitnessPassportSchema = z.object({
  fitness_goals: z.array(z.enum(FITNESS_GOALS)).min(1, 'Select at least one goal').max(5),
  workout_types: z.array(z.enum(WORKOUT_TYPES)).min(1, 'Select at least one workout type').max(8),
  training_frequency: z.enum(['1-2', '3-4', '5-6', '7+'], { message: 'Select training frequency' }),
  physical_limitations: z.string().max(1000, 'Please keep under 1000 characters').optional(),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
});

/** Admin tier override */
export const adminTierOverrideSchema = z.object({
  trainerId: z.string().uuid('Invalid trainer ID'),
  tier: z.enum(SUBSCRIPTION_TIERS, { message: 'Tier must be free, pro, or elite' }),
  reason: z.string().max(500, 'Reason must be under 500 characters').optional(),
});

/** Platform settings (admin) */
export const platformSettingsSchema = z.object({
  platform_fee_percentage: z.number().min(1, 'Fee must be at least 1%').max(50, 'Fee cannot exceed 50%'),
});

/** Booking creation */
export const bookingSchema = z.object({
  slot_id: z.string().uuid('Invalid slot ID'),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional(),
});

// --- Phase 19: Calendar & Buffer Times Schemas ---

export const BUFFER_OPTIONS = [0, 15, 30, 45, 60] as const;

/** Buffer time between bookings */
export const bufferTimeSchema = z.object({
  buffer_minutes: z.number().int().refine(
    (v) => [0, 15, 30, 45, 60].includes(v),
    { message: 'Buffer must be 0, 15, 30, 45, or 60 minutes' }
  ),
});

// --- Type Exports ---

export type ReviewInput = z.infer<typeof reviewSchema>;
export type BookingNotesInput = z.infer<typeof bookingNotesSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type TrainerProfileInput = z.infer<typeof trainerProfileSchema>;
export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
export type FitnessPassportInput = z.infer<typeof fitnessPassportSchema>;
export type AdminTierOverrideInput = z.infer<typeof adminTierOverrideSchema>;
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type BufferTimeInput = z.infer<typeof bufferTimeSchema>;
