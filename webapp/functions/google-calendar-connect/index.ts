import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

// IMPORTANT: Frontend must use prompt='consent' and access_type='offline' in the OAuth URL
// to ensure a refresh_token is returned on every authorization (Pitfall 1).
// Without prompt='consent', Google will only return refresh_token on the first authorization.

interface ConnectRequest {
  action: 'connect' | 'disconnect';
  code?: string;
}

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

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Get the trainer_profiles row for this user
    const { data: trainerProfile, error: profileError } = await adminClient
      .from('trainer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !trainerProfile) {
      return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as ConnectRequest;
    const { action, code } = body;

    if (action !== 'connect' && action !== 'disconnect') {
      return new Response(JSON.stringify({ error: 'action must be connect or disconnect' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Connect: exchange authorization code for tokens ─────────────────────
    if (action === 'connect') {
      if (!code) {
        return new Response(JSON.stringify({ error: 'code is required for connect action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientId = requireEnv('GOOGLE_CLIENT_ID');
      const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
      const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');

      // Exchange authorization code for access + refresh tokens
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResp.json();

      if (!tokenResp.ok || tokenData.error) {
        return new Response(
          JSON.stringify({ error: tokenData.error_description ?? tokenData.error ?? 'Token exchange failed' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const accessToken: string = tokenData.access_token;
      const refreshToken: string = tokenData.refresh_token;
      const expiresAt = new Date(Date.now() + (tokenData.expires_in as number) * 1000).toISOString();
      const connectedAt = new Date().toISOString();

      // Upsert connection — conflict on trainer_id (one connection per trainer)
      const { error: upsertError } = await adminClient
        .from('google_calendar_connections')
        .upsert(
          {
            trainer_id: trainerProfile.id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            is_active: true,
            disconnected_reason: null,
            connected_at: connectedAt,
            last_sync_at: null,
          },
          { onConflict: 'trainer_id' }
        );

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ success: true, connected_at: connectedAt }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ─── Disconnect: remove connection and all related data ──────────────────
    if (action === 'disconnect') {
      // Delete all gcal_blocked_slots for this trainer
      await adminClient
        .from('gcal_blocked_slots')
        .delete()
        .eq('trainer_id', trainerProfile.id);

      // Clear gcal_event_id on all bookings for this trainer
      await adminClient
        .from('bookings')
        .update({ gcal_event_id: null })
        .eq('trainer_id', trainerProfile.id);

      // Delete the connection row
      const { error: deleteError } = await adminClient
        .from('google_calendar_connections')
        .delete()
        .eq('trainer_id', trainerProfile.id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
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
    }
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
