import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const userEmail = user.email;

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Get trainer_profile id if it exists (needed for cascading deletes)
    const { data: trainerProfile } = await adminClient
      .from('trainer_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const trainerId = trainerProfile?.id;

    // 1. Delete post_workout_surveys (via booking_id in bookings where client_id = userId)
    const { data: userBookings } = await adminClient
      .from('bookings')
      .select('id')
      .eq('client_id', userId);

    const bookingIds = (userBookings ?? []).map((b: { id: string }) => b.id);

    if (bookingIds.length > 0) {
      await adminClient
        .from('post_workout_surveys')
        .delete()
        .in('booking_id', bookingIds);

      // 2. Delete session_logs (via booking_id)
      await adminClient
        .from('session_logs')
        .delete()
        .in('booking_id', bookingIds);
    }

    // 3. Delete notifications
    await adminClient
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    // 4. Delete reviews
    await adminClient
      .from('reviews')
      .delete()
      .eq('client_id', userId);

    // 5. Delete support_messages (via ticket_id in support_tickets where user_id = userId)
    const { data: userTickets } = await adminClient
      .from('support_tickets')
      .select('id')
      .eq('user_id', userId);

    const ticketIds = (userTickets ?? []).map((t: { id: string }) => t.id);

    if (ticketIds.length > 0) {
      await adminClient
        .from('support_messages')
        .delete()
        .in('ticket_id', ticketIds);
    }

    // 6. Delete support_tickets
    await adminClient
      .from('support_tickets')
      .delete()
      .eq('user_id', userId);

    // 7. Delete messages
    await adminClient
      .from('messages')
      .delete()
      .eq('sender_id', userId);

    // 8. Delete conversations
    await adminClient
      .from('conversations')
      .delete()
      .or(`client_id.eq.${userId},trainer_id.eq.${userId}`);

    // 9. Delete bookings
    await adminClient
      .from('bookings')
      .delete()
      .eq('client_id', userId);

    // 9b. Delete trainer_session_logs about this client (Phase 33).
    // trainer_session_logs.client_id references profiles.id (= userId).
    // ON DELETE CASCADE covers trainer_session_exercises + trainer_exercise_sets.
    await adminClient
      .from('trainer_session_logs')
      .delete()
      .eq('client_id', userId);

    // Trainer-specific child rows
    if (trainerId) {
      // 10. Delete availability_slots
      await adminClient
        .from('availability_slots')
        .delete()
        .eq('trainer_id', trainerId);

      // 11. Delete booking_requests
      await adminClient
        .from('booking_requests')
        .delete()
        .eq('trainer_id', trainerId);

      // 12. Delete trainer_certifications
      await adminClient
        .from('trainer_certifications')
        .delete()
        .eq('trainer_id', trainerId);

      // 13. Delete google_calendar_connections
      await adminClient
        .from('google_calendar_connections')
        .delete()
        .eq('trainer_id', trainerId);

      // 14. Delete trainer_session_logs authored by this trainer (Phase 33).
      // ON DELETE CASCADE covers trainer_session_exercises + trainer_exercise_sets.
      await adminClient
        .from('trainer_session_logs')
        .delete()
        .eq('trainer_id', trainerId);
    }

    // 14. Delete client_profiles
    await adminClient
      .from('client_profiles')
      .delete()
      .eq('user_id', userId);

    // 15. Delete client_notification_preferences
    await adminClient
      .from('client_notification_preferences')
      .delete()
      .eq('user_id', userId);

    // 16. Delete trainer_profiles
    await adminClient
      .from('trainer_profiles')
      .delete()
      .eq('user_id', userId);

    // 17. Delete email_subscribers (by email)
    if (userEmail) {
      await adminClient
        .from('email_subscribers')
        .delete()
        .eq('email', userEmail);
    }

    // 18. Delete profiles
    await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    // 19. Delete the auth user
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      return new Response(JSON.stringify({ error: deleteUserError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
