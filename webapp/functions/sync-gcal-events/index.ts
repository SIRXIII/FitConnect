import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';
import { getValidAccessToken, listGcalEvents } from '../_shared/gcal-helpers.ts';

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

    const authHeader = req.headers.get('Authorization') || '';

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Determine scope: service-role = all trainers, user auth = scoped to own trainer
    const isServiceRole = authHeader.includes(supabaseServiceRoleKey);

    let connections: Array<{
      trainer_id: string;
      access_token: string;
      refresh_token: string;
      expires_at: string;
      is_active: boolean;
    }> = [];

    if (isServiceRole) {
      // pg_cron path: sync all active connections
      const { data, error } = await adminClient
        .from('google_calendar_connections')
        .select('*')
        .eq('is_active', true);

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch connections' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      connections = data ?? [];
    } else {
      // User-triggered "sync now": validate auth and scope to their trainer profile
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

      // Fetch trainer profile to get trainer_id
      const { data: trainerProfile } = await adminClient
        .from('trainer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!trainerProfile) {
        return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: connection } = await adminClient
        .from('google_calendar_connections')
        .select('*')
        .eq('trainer_id', trainerProfile.id)
        .eq('is_active', true)
        .maybeSingle();

      if (connection) {
        connections = [connection];
      }
    }

    let syncedTrainers = 0;

    for (const connection of connections) {
      // Wrap each trainer in its own try/catch so one failure doesn't stop others
      try {
        // Get valid access token (handles refresh + marks inactive on revocation)
        let accessToken: string;
        try {
          accessToken = await getValidAccessToken(connection, adminClient);
        } catch (err) {
          if (err instanceof Error && err.message === 'gcal_token_revoked') {
            // Already marked inactive by helper — skip this trainer
            continue;
          }
          throw err;
        }

        // Compute 28-day window starting now
        const now = new Date();
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString();

        // Poll GCal for external events (fitrush-tagged events excluded by listGcalEvents)
        const gcalEvents = await listGcalEvents(accessToken, timeMin, timeMax);

        // Filter to timed events only — skip all-day events (they have start.date, not start.dateTime)
        const timedEvents = gcalEvents.filter(
          (e) => e.start?.dateTime && e.end?.dateTime,
        );

        // Cleanup past blocked slots for this trainer (before timeMin)
        await adminClient
          .from('gcal_blocked_slots')
          .delete()
          .eq('trainer_id', connection.trainer_id)
          .lt('ends_at', timeMin);

        // Upsert current external events into gcal_blocked_slots
        if (timedEvents.length > 0) {
          const upsertRows = timedEvents.map((event) => ({
            trainer_id: connection.trainer_id,
            gcal_event_id: event.id,
            gcal_summary: event.summary ?? null,
            starts_at: event.start.dateTime,
            ends_at: event.end.dateTime,
            synced_at: new Date().toISOString(),
          }));

          await adminClient
            .from('gcal_blocked_slots')
            .upsert(upsertRows, { onConflict: 'trainer_id,gcal_event_id' });
        }

        // Apply GCal blocks to availability_slots via RPC
        await adminClient.rpc('apply_gcal_blocks', { p_trainer_id: connection.trainer_id });

        // Update last_sync_at on the connection record
        await adminClient
          .from('google_calendar_connections')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('trainer_id', connection.trainer_id);

        syncedTrainers++;
      } catch (trainerErr) {
        console.error(
          `sync-gcal-events: failed for trainer ${connection.trainer_id}:`,
          trainerErr,
        );
        // Continue to next trainer — one failure must not stop the loop
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced_trainers: syncedTrainers }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
