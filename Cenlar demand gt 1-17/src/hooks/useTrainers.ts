import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

export function useTrainers(options: UseTrainersOptions = {}) {
  const [trainers, setTrainers] = useState<TrainerWithProfile[]>([]);
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
      `)
      .order('rating', { ascending: false });

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
      query = query.ilike('location', `%${options.location}%`);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTrainers((data as TrainerWithProfile[]) || []);
    }
    setLoading(false);
  }, [options.specialty, options.maxRate, options.minRating, options.location]);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  return { trainers, loading, error, refetch: fetchTrainers };
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
