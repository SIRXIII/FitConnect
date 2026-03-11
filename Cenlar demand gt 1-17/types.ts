export enum TrainerSpecialty {
    STRENGTH = 'Strength Training',
    CARDIO = 'Cardio & HIIT',
    YOGA = 'Yoga & Pilates',
    NUTRITION = 'Nutrition Coaching',
    REHAB = 'Injury Rehabilitation'
  }
  
  export enum PriceRange {
    BUDGET = 'budget',
    STANDARD = 'standard',
    PREMIUM = 'premium'
  }
  
  export interface Trainer {
    id: string;
    name: string;
    location: string;
    specialty: TrainerSpecialty;
    rating: number;
    reviewCount: number;
    hourlyRate: number;
    discountedRate: number;
    imageUrl: string;
    verified: boolean;
    availableNow: boolean;
  }
  
  export interface FilterState {
    location: string;
    specialty: string;
    priceRange: string;
  }