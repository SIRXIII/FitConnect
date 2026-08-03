import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TrainerPin, MapBounds, LocationType } from '@/types/map';

export function useMapTrainers() {
  const [pins, setPins] = useState<TrainerPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPinsInView = useCallback(async (bounds: MapBounds) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch live trainer locations within viewport bounds via RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('trainers_in_view', {
        min_lat: bounds.south,
        min_lng: bounds.west,
        max_lat: bounds.north,
        max_lng: bounds.east,
      });

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      if (!rpcData || rpcData.length === 0) {
        setPins([]);
        setLoading(false);
        return;
      }

      // Batch fetch trainer profile data for enrichment
      const trainerIds = rpcData.map((row: { trainer_id: string }) => row.trainer_id);

      const { data: profiles, error: profileError } = await supabase
        .from('trainer_profiles')
        .select('*, profiles!trainer_profiles_user_id_fkey(full_name, avatar_url)')
        .in('id', trainerIds);

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      // Build lookup map from profile data
      type ProfileRow = {
        id: string;
        specialty: string;
        optimized_rate: number;
        discount_percentage: number;
        rating: number;
        review_count: number;
        subscription_tier: 'free' | 'pro' | 'elite';
        booking_mode: 'instant' | 'request';
        availability_status: 'offline' | 'live';
        profiles: { full_name: string; avatar_url: string | null } | null;
      };

      const profileMap = new Map<string, ProfileRow>();
      if (profiles) {
        for (const p of profiles as unknown as ProfileRow[]) {
          profileMap.set(p.id, p);
        }
      }

      // Merge RPC location data with profile enrichment data
      const enriched: TrainerPin[] = rpcData.map((row: {
        trainer_id: string;
        latitude: number;
        longitude: number;
        location_type: string;
        nickname: string | null;
      }) => {
        const profile = profileMap.get(row.trainer_id);
        const discountPct = profile?.discount_percentage ?? 0;
        const optimizedRate = Number(profile?.optimized_rate ?? 0);
        const discountedRate = discountPct > 0
          ? Math.round(optimizedRate * (1 - discountPct / 100) * 100) / 100
          : optimizedRate;

        return {
          trainer_id: row.trainer_id,
          latitude: row.latitude,
          longitude: row.longitude,
          location_type: row.location_type as LocationType,
          nickname: row.nickname,
          name: profile?.profiles?.full_name ?? undefined,
          specialty: profile?.specialty ?? undefined,
          rate: optimizedRate > 0 ? optimizedRate : undefined,
          discountedRate: discountPct > 0 ? discountedRate : undefined,
          discountPercentage: discountPct > 0 ? discountPct : undefined,
          rating: profile ? Number(profile.rating) : undefined,
          reviewCount: profile?.review_count ?? undefined,
          avatarUrl: profile?.profiles?.avatar_url ?? null,
          subscriptionTier: profile?.subscription_tier ?? undefined,
          bookingMode: profile?.booking_mode ?? undefined,
          isLive: profile?.availability_status === 'live',
        };
      });

      setPins(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching trainers');
    } finally {
      setLoading(false);
    }
  }, []);

  return { pins, loading, error, fetchPinsInView };
}
