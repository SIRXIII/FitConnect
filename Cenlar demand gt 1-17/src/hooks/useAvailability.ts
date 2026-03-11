import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

export interface AvailabilitySlot {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  created_at: string;
}

export function useAvailability() {
  const { trainerProfile } = useAuthStore();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSlots = useCallback(async () => {
    if (!trainerProfile) return;

    setLoading(true);
    const { data } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('trainer_id', trainerProfile.id)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    setSlots((data as AvailabilitySlot[]) || []);
    setLoading(false);
  }, [trainerProfile]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const addSlot = async (startTime: Date, endTime: Date) => {
    if (!trainerProfile) return;

    const { error } = await supabase
      .from('availability_slots')
      .insert({
        trainer_id: trainerProfile.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });

    if (error) throw error;
    await fetchSlots();
  };

  const removeSlot = async (slotId: string) => {
    const { error } = await supabase
      .from('availability_slots')
      .delete()
      .eq('id', slotId)
      .eq('is_booked', false);

    if (error) throw error;
    await fetchSlots();
  };

  const addWeekSlots = async (
    weekStart: Date,
    dayHours: { day: number; hours: { start: number; end: number }[] }[]
  ) => {
    if (!trainerProfile) return;

    const slotsToInsert = dayHours.flatMap(({ day, hours }) =>
      hours.map(({ start, end }) => {
        const slotDate = new Date(weekStart);
        slotDate.setDate(slotDate.getDate() + day);

        const startTime = new Date(slotDate);
        startTime.setHours(start, 0, 0, 0);

        const endTime = new Date(slotDate);
        endTime.setHours(end, 0, 0, 0);

        return {
          trainer_id: trainerProfile.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        };
      })
    );

    if (slotsToInsert.length === 0) return;

    const { error } = await supabase
      .from('availability_slots')
      .insert(slotsToInsert);

    if (error) throw error;
    await fetchSlots();
  };

  return { slots, loading, addSlot, removeSlot, addWeekSlots, refetch: fetchSlots };
}
