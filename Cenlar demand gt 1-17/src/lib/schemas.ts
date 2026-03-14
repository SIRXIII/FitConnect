import { z } from 'zod';

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

export type ReviewInput = z.infer<typeof reviewSchema>;
export type BookingNotesInput = z.infer<typeof bookingNotesSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
