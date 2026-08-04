export enum PriceRange {
  BUDGET = 'budget',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

// Legacy mock trainer type (used as fallback when DB is empty)
export interface Trainer {
  id: string;
  name: string;
  location: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  optimizedRate: number;
  discountPercentage: number;
  discountedRate: number;
  imageUrl: string;
  verified: boolean;
  availableNow: boolean;
  idleSlotCount: number;
  isLive?: boolean;
  bookingMode?: 'instant' | 'request';
  intro_video_url?: string | null;
}

// DB specialty enum values
export const SPECIALTY_LABELS: Record<string, string> = {
  strength_training: 'Strength Training',
  cardio_hiit: 'Cardio & HIIT',
  yoga_pilates: 'Yoga & Pilates',
  nutrition_coaching: 'Nutrition Coaching',
  injury_rehabilitation: 'Injury Rehabilitation',
};

export const DB_SPECIALTIES = Object.keys(SPECIALTY_LABELS);

export function formatSpecialty(dbValue: string): string {
  return SPECIALTY_LABELS[dbValue] || dbValue.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FilterState {
  location: string;
  specialty: string;
  priceRange: string;
}
