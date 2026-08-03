import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkoutLocation, LocationType } from '@/types/map';

export interface AddLocationData {
  address: string;
  nickname?: string | null;
  latitude: number;
  longitude: number;
  location_type: LocationType;
}

export interface UpdateLocationData {
  nickname?: string | null;
  latitude?: number;
  longitude?: number;
  location_type?: LocationType;
}

export interface UseWorkoutLocationsReturn {
  locations: WorkoutLocation[];
  loading: boolean;
  error: string | null;
  canAddMore: boolean;
  addLocation: (trainerId: string, data: AddLocationData) => Promise<WorkoutLocation | null>;
  updateLocation: (id: string, data: UpdateLocationData) => Promise<WorkoutLocation | null>;
  deleteLocation: (id: string) => Promise<void>;
  refetch: (trainerId: string) => Promise<void>;
}

export function useWorkoutLocations(trainerId?: string): UseWorkoutLocationsReturn {
  const [locations, setLocations] = useState<WorkoutLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async (tid: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('workout_locations')
        .select('*')
        .eq('trainer_id', tid)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setLocations((data as WorkoutLocation[]) ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load locations';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when trainerId provided
  useEffect(() => {
    if (trainerId) {
      fetchLocations(trainerId);
    }
  }, [trainerId, fetchLocations]);

  const addLocation = useCallback(
    async (tid: string, data: AddLocationData): Promise<WorkoutLocation | null> => {
      setError(null);
      try {
        const { data: inserted, error: insertError } = await supabase
          .from('workout_locations')
          .insert({
            trainer_id: tid,
            address: data.address,
            nickname: data.nickname ?? null,
            latitude: data.latitude,
            longitude: data.longitude,
            location_type: data.location_type,
          })
          .select()
          .single();

        if (insertError) {
          // P0001 = raise_exception from check_location_limit trigger
          if (insertError.code === 'P0001' || insertError.message?.includes('Maximum')) {
            setError('Maximum 5 workout locations allowed');
          } else {
            setError(insertError.message);
          }
          return null;
        }

        await fetchLocations(tid);
        return inserted as WorkoutLocation;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to add location';
        setError(msg);
        return null;
      }
    },
    [fetchLocations]
  );

  const updateLocation = useCallback(
    async (id: string, data: UpdateLocationData): Promise<WorkoutLocation | null> => {
      setError(null);
      try {
        const { data: updated, error: updateError } = await supabase
          .from('workout_locations')
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          setError(updateError.message);
          return null;
        }

        // Refetch using trainer_id from the updated record
        const result = updated as WorkoutLocation;
        await fetchLocations(result.trainer_id);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update location';
        setError(msg);
        return null;
      }
    },
    [fetchLocations]
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      setError(null);
      // Find trainer_id before deleting so we can refetch
      const target = locations.find((l) => l.id === id);
      try {
        const { error: deleteError } = await supabase
          .from('workout_locations')
          .delete()
          .eq('id', id);

        if (deleteError) {
          setError(deleteError.message);
          return;
        }

        if (target) {
          await fetchLocations(target.trainer_id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete location';
        setError(msg);
      }
    },
    [locations, fetchLocations]
  );

  const canAddMore = locations.length < 5;

  return {
    locations,
    loading,
    error,
    canAddMore,
    addLocation,
    updateLocation,
    deleteLocation,
    refetch: fetchLocations,
  };
}
