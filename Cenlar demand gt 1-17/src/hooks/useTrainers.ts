import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { sanitizeSearchInput } from '@/lib/sanitize';
import { buildIdleSlotCounts } from '@/lib/scheduling';
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

// Weighted-blend ranking: discount 40%, rating 25%, proximity 20%, availability 15%
export function rankTrainers(
  trainers: TrainerWithProfile[],
  slotCounts: Record<string, number>,
  locationFilter?: string
): TrainerWithProfile[] {
  const scored = trainers.map((t) => {
    const discountScore = (t.discount_percentage ?? 0) / 80;
    const ratingScore = Number(t.rating) / 5;
    const proximityScore =
      locationFilter && locationFilter.length > 0
        ? t.location.toLowerCase().includes(locationFilter.toLowerCase())
          ? 1
          : 0
        : 0.5; // neutral when no filter active
    const availabilityScore = Math.min((slotCounts[t.id] ?? 0) / 10, 1);

    const score =
      0.40 * discountScore +
      0.25 * ratingScore +
      0.20 * proximityScore +
      0.15 * availabilityScore;

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
        profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
      `);

    if (options.specialty) {
      query = query.eq('specialty', options.specialty);
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

export function useTrainerById(trainerId: string | undefined) {
  const [trainer, setTrainer] = useState<TrainerWithProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trainerId) return;

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
