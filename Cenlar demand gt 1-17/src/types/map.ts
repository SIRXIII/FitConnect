export type LocationType = 'gym' | 'park' | 'in-home';

export interface WorkoutLocation {
  id: string;
  trainer_id: string;
  nickname: string | null;
  address: string;
  latitude: number;
  longitude: number;
  location_type: LocationType;
  created_at: string;
  updated_at: string;
}

export interface TrainerPin {
  trainer_id: string;
  latitude: number;
  longitude: number;
  location_type: LocationType;
  nickname: string | null;
  // Enriched client-side from trainer data:
  name?: string;
  specialty?: string;
  rate?: number;
  discountedRate?: number;
  discountPercentage?: number;
  rating?: number;
  reviewCount?: number;
  avatarUrl?: string | null;
  subscriptionTier?: 'free' | 'pro' | 'elite';
  bookingMode?: 'instant' | 'request';
  isLive?: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const PIN_COLORS: Record<LocationType, string> = {
  gym: '#2563EB',
  park: '#16A34A',
  'in-home': '#D97706',
};

export const LA_DEFAULT = { lat: 34.0522, lng: -118.2437 };
