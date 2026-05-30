import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import {
  rankAndFilter,
  isPassportReady,
  getCachedMatches,
  setCachedMatches,
  type MatchResult,
} from '@/lib/matchScoring';

interface UseMatchedTrainersResult {
  results: MatchResult[];
  passportReady: boolean | null;
  loading: boolean;
}

export function useMatchedTrainers(): UseMatchedTrainersResult {
  const { user } = useAuthStore();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [passportReady, setPassportReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchMatches = async () => {
      setLoading(true);

      // Check 24hr localStorage cache first
      const cached = getCachedMatches(user.id);
      if (cached) {
        setResults(cached);
        setPassportReady(true);
        setLoading(false);
        return;
      }

      // Fetch client profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cp, error: cpError } = await (supabase as any)
        .from('client_profiles')
        .select('fitness_level, goals_ranked, workout_types, hourly_budget_max')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cpError || !cp) {
        // No client profile found — treat as passport not ready
        setPassportReady(false);
        setLoading(false);
        return;
      }

      // Check completeness gate
      if (!isPassportReady(cp)) {
        setPassportReady(false);
        setLoading(false);
        return;
      }

      // Fetch trainers for scoring
      const { data: trainers } = await supabase
        .from('trainer_profiles')
        .select(`
          id,
          optimized_rate,
          specialty,
          profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
        `);

      const ranked = rankAndFilter(cp, trainers ?? [], 3);

      setCachedMatches(user.id, ranked);
      setResults(ranked);
      setPassportReady(true);
      setLoading(false);
    };

    fetchMatches();
  }, [user]);

  return { results, passportReady, loading };
}
