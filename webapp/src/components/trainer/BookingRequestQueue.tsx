import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import BookingRequestCard from './BookingRequestCard';

interface BookingRequest {
  id: string;
  client_id: string;
  slot_id: string;
  trainer_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  client?: {
    full_name: string;
    avatar_url: string | null;
  };
  slot?: {
    start_time: string;
    end_time: string;
  };
  client_profile?: {
    fitness_level: string | null;
    goals_ranked: string[];
    health_conditions: string[];
    intensity_preference: string | null;
    health_notes: string | null;
    age: number | null;
    weight_lbs: number | null;
    workout_types: string[];
  } | null;
}

const BookingRequestQueue: React.FC = () => {
  const { trainerProfile } = useAuthStore();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!trainerProfile?.id) return;

    const { data, error } = await supabase
      .from('booking_requests')
      .select(
        '*, profiles!booking_requests_client_id_fkey(full_name, avatar_url), client_profiles!booking_requests_client_id_fkey(fitness_level, goals_ranked, health_conditions, intensity_preference, health_notes, age, weight_lbs, workout_types), availability_slots!booking_requests_slot_id_fkey(start_time, end_time)'
      )
      .eq('trainer_id', trainerProfile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (!error && data) {
      const mapped: BookingRequest[] = (data as unknown as Array<{
        id: string;
        client_id: string;
        slot_id: string;
        trainer_id: string;
        status: 'pending' | 'accepted' | 'declined';
        created_at: string;
        profiles?: { full_name: string; avatar_url: string | null };
        client_profiles?: {
          fitness_level: string | null;
          goals_ranked: string[];
          health_conditions: string[];
          intensity_preference: string | null;
          health_notes: string | null;
          age: number | null;
          weight_lbs: number | null;
          workout_types: string[];
        } | null;
        availability_slots?: { start_time: string; end_time: string };
      }>).map((row) => ({
        id: row.id,
        client_id: row.client_id,
        slot_id: row.slot_id,
        trainer_id: row.trainer_id,
        status: row.status,
        created_at: row.created_at,
        client: row.profiles ?? undefined,
        slot: row.availability_slots ?? undefined,
        client_profile: row.client_profiles ?? undefined,
      }));
      setRequests(mapped);
    }
    setLoading(false);
  }, [trainerProfile?.id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime subscription — refetch on any booking_requests change for this trainer
  useEffect(() => {
    if (!trainerProfile?.id) return;

    const channel = supabase
      .channel(`booking-requests-${trainerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `trainer_id=eq.${trainerProfile.id}`,
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trainerProfile?.id, fetchRequests]);

  const handleAccept = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request || !trainerProfile) return;

    // One server-side transaction: flips the request to accepted and creates the
    // booking at the server quote (replaces the update + create_booking_atomic pair).
    const { data, error } = await supabase.rpc('accept_booking_request', {
      p_request_id: requestId,
    });

    if (error) {
      toast.error('Failed to accept request. Please try again.');
      return;
    }

    const result = data as { booking_id?: string; error?: string } | null;
    if (!result?.booking_id) {
      toast.error(
        result?.error === 'slot_taken'
          ? 'That slot was booked in the meantime.'
          : 'Failed to accept request. Please try again.'
      );
      return;
    }

    // Fire-and-forget: push booking to trainer's Google Calendar (if connected)
    supabase.functions.invoke('sync-booking-to-gcal', {
      body: { booking_id: result.booking_id },
    }).catch(() => { /* GCal sync is best-effort */ });

    const clientName = request.client?.full_name || 'client';
    toast.success(`Booking confirmed with ${clientName}`);
    fetchRequests();
  };

  const handleDecline = async (requestId: string) => {
    const { error } = await supabase
      .from('booking_requests')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString(),
        decline_reason: 'trainer_declined',
      })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to decline request. Please try again.');
      return;
    }

    toast('Request declined');
    fetchRequests();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="border border-ink/10 p-6 animate-pulse">
            <div className="h-10 bg-ink/5 rounded mb-4" />
            <div className="h-4 bg-ink/5 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="border border-dashed border-ink/10 p-12 text-center space-y-3">
        <h3 className="text-xl serif font-light text-ink italic">No pending requests</h3>
        <p className="text-sm text-ink/80">
          Booking requests from clients will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {requests.map((request) => (
          <BookingRequestCard
            key={request.id}
            request={request}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default BookingRequestQueue;
