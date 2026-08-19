import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { sanitizeSearchInput } from '@/lib/sanitize';
import { buildIdleSlotCounts } from '@/lib/scheduling';
import { MOCK_TRAINERS } from '@/lib/constants';
import type { TrainerProfile } from '@/stores/auth';

export interface TrainerWithProfile extends TrainerProfile {
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface UseTrainersOptions {
  specialty?: string;
  maxRate?: number;
  minRating?: number;
  location?: string;
}

// Weighted-blend ranking: discount 25%, profile 20%, rating 15%, proximity 15%, tier 15%, availability 10%
export function rankTrainers(
  trainers: TrainerWithProfile[],
  slotCounts: Record<string, number>,
  locationFilter?: string
): TrainerWithProfile[] {
  const scored = trainers.map((t) => {
    const discountScore = (t.discount_percentage ?? 0) / 80;
    const ratingScore = Number(t.rating) / 5;
    // rank_score (0-1) is trigger-maintained and blends credential score, rating,
    // profile completeness and booking volume. Without it this client-side re-sort
    // silently discards the DB ordering, so a richer profile earns nothing.
    const profileScore = Math.min(Math.max(Number(t.rank_score ?? 0), 0), 1);
    const proximityScore =
      locationFilter && locationFilter.length > 0
        ? t.location.toLowerCase().includes(locationFilter.toLowerCase())
          ? 1
          : 0
        : 0.5; // neutral when no filter active
    const availabilityScore = Math.min((slotCounts[t.id] ?? 0) / 10, 1);
    const tierScore = (() => {
      const tier = t.subscription_tier as string | null | undefined;
      if (tier === 'elite') return 1.0;
      if (tier === 'pro') return 0.67;
      return 0.0;
    })();

    const score =
      0.25 * discountScore +
      0.20 * profileScore +
      0.15 * ratingScore +
      0.15 * proximityScore +
      0.10 * availabilityScore +
      0.15 * tierScore;

    return { trainer: t, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.trainer);
}

export function useTrainers(options: UseTrainersOptions = {}) {
  const [trainers, setTrainers] = useState<TrainerWithProfile[]>([]);
  const [idleSlotCounts, setIdleSlotCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainers = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('trainer_profiles')
      .select(`
        *,
        profiles!trainer_profiles_user_id_fkey!inner (full_name, avatar_url)
      `)
      // Hide suspended trainers from the marketplace. !inner drops the parent row
      // (not just the embed) when the profile is suspended.
      .eq('profiles.is_suspended', false)
      .order('rank_score', { ascending: false });

    if (options.specialty) {
      // Match any of the trainer's specialties (backfilled from the primary),
      // so multi-specialty trainers surface under each one they chose.
      query = query.contains('specialties', [options.specialty]);
    }
    if (options.maxRate) {
      query = query.lte('optimized_rate', options.maxRate);
    }
    if (options.minRating) {
      query = query.gte('rating', options.minRating);
    }
    if (options.location) {
      const safeLocation = sanitizeSearchInput(options.location);
      if (safeLocation.length > 0) {
        query = query.ilike('location', `%${safeLocation}%`);
      }
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const raw = (data as unknown as TrainerWithProfile[]) || [];

    // Fetch slot data for availability ranking and idle classification
    let slotCounts: Record<string, number> = {};
    let idleCounts: Record<string, number> = {};
    if (raw.length > 0) {
      const { data: slots } = await supabase
        .from('availability_slots')
        .select('trainer_id, start_time, is_booked, deleted_at')
        .in('trainer_id', raw.map((t) => t.id))
        .eq('is_booked', false)
        .is('deleted_at', null)
        .gte('start_time', new Date().toISOString());

      if (slots) {
        type SlotRow = { trainer_id: string; start_time: string; is_booked: boolean; deleted_at: string | null };
        const typedSlots = slots as SlotRow[];

        slotCounts = typedSlots.reduce((acc, s) => {
          acc[s.trainer_id] = (acc[s.trainer_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        idleCounts = buildIdleSlotCounts(typedSlots);
      }
    }

    setIdleSlotCounts(idleCounts);
    setTrainers(rankTrainers(raw, slotCounts, options.location));
    setLoading(false);
  }, [options.specialty, options.maxRate, options.minRating, options.location]);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  return { trainers, loading, error, refetch: fetchTrainers, idleSlotCounts };
}

/** Returns true for mock/demo IDs like '1', '2', '3' (non-UUID strings) */
function isMockId(id: string): boolean {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
}

/** Map a MOCK_TRAINERS entry to the TrainerWithProfile DB shape */
function mockToTrainerWithProfile(mock: (typeof MOCK_TRAINERS)[number]): TrainerWithProfile {
  const specialtyMap: Record<string, string> = {
    'Strength Training': 'strength_training',
    'Cardio & HIIT': 'cardio',
    'Yoga & Pilates': 'yoga',
    'Nutrition Coaching': 'nutrition',
    'Injury Rehabilitation': 'rehabilitation',
  };
  return {
    id: mock.id,
    user_id: `mock-${mock.id}`,
    specialty: specialtyMap[mock.specialty] ?? 'strength_training',
    bio: `Elite ${mock.specialty.toLowerCase()} trainer based in ${mock.location}. Specializing in personalized sessions tailored to your fitness goals.`,
    hourly_rate: mock.hourlyRate,
    optimized_rate: mock.optimizedRate,
    discount_percentage: mock.discountPercentage,
    location: mock.location,
    latitude: null,
    longitude: null,
    certifications: ['NASM', 'CPT'],
    verified: mock.verified,
    rating: mock.rating,
    review_count: mock.reviewCount,
    stripe_account_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profiles: {
      full_name: mock.name,
      avatar_url: mock.imageUrl,
    },
  } as unknown as TrainerWithProfile;
}

export function useTrainerById(trainerId: string | undefined) {
  const [trainer, setTrainer] = useState<TrainerWithProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trainerId) {
      setTrainer(null);
      setLoading(false);
      return;
    }

    // Demo trainers (numeric IDs) — skip DB, serve mock data immediately
    if (isMockId(trainerId)) {
      const mock = MOCK_TRAINERS.find((t) => t.id === trainerId);
      setTrainer(mock ? mockToTrainerWithProfile(mock) : null);
      setLoading(false);
      return;
    }

    const fetchTrainer = async () => {
      const { data } = await supabase
        .from('trainer_profiles')
        .select(`
          *,
          profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
        `)
        .eq('id', trainerId)
        .single();

      setTrainer(data as TrainerWithProfile | null);
      setLoading(false);
    };

    fetchTrainer();
  }, [trainerId]);

  return { trainer, loading };
}

export function useTrainerBySlug(slug: string | undefined) {
  const [trainer, setTrainer] = useState<TrainerWithProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setTrainer(null);
      setLoading(false);
      return;
    }

    const fetchTrainer = async () => {
      const { data } = await supabase
        .from('trainer_profiles')
        .select(`
          *,
          profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
        `)
        .eq('slug', slug)
        .single();

      setTrainer(data as TrainerWithProfile | null);
      setLoading(false);
    };

    fetchTrainer();
  }, [slug]);

  return { trainer, loading };
}
