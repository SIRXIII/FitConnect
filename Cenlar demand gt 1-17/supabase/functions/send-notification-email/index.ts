import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

interface SendNotificationEmailRequest {
  to?: string;
  subject?: string;
  body?: string;
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

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
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

    // Validate required body fields
    const body = (await req.json().catch(() => ({}))) as SendNotificationEmailRequest;

    if (!body.to || typeof body.to !== 'string' || body.to.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'to is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.subject || typeof body.subject !== 'string' || body.subject.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'subject is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.body || typeof body.body !== 'string' || body.body.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'body is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      // Fallback to logging if no API key configured (dev mode)
      console.log('[send-notification-email] No RESEND_API_KEY, logging:', {
        to: body.to,
        subject: body.subject,
      });
    } else {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'FitRush <noreply@resend.dev>',
          to: [body.to],
          subject: body.subject,
          html: body.body,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[send-notification-email] Resend error:', res.status, errBody);
        // Still return success to caller — email failure should not block operations
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification queued' }),
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
