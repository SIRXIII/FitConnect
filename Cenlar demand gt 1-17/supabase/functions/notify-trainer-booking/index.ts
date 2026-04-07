import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

interface NotifyRequest {
  booking_id?: string;
  trainer_user_id: string;
  client_name: string;
  session_date: string;
  session_end: string;
  rate: number;
  mode: 'instant' | 'request';
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
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    // Verify caller is authenticated (user JWT or service_role key)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceRoleKey;

    if (!isServiceRole) {
      const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as Partial<NotifyRequest>;
    const { trainer_user_id, client_name, session_date, session_end, rate, mode } = body;

    if (!trainer_user_id || !client_name || !session_date) {
      return new Response(JSON.stringify({ error: 'trainer_user_id, client_name, and session_date are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Look up trainer's email from auth.users
    const { data: { user: trainerUser }, error: trainerError } = await adminClient.auth.admin.getUserById(trainer_user_id);

    if (trainerError || !trainerUser?.email) {
      console.error('[notify-trainer-booking] Could not find trainer email:', trainerError);
      return new Response(JSON.stringify({ error: 'Trainer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startDate = new Date(session_date);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const endTime = session_end
      ? new Date(session_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const isRequest = mode === 'request';
    const subject = isRequest
      ? `New Booking Request from ${client_name}`
      : `New Session Booked - ${client_name}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="font-size: 20px; font-weight: 400; color: #1a1a1a;">
          ${isRequest ? 'New Booking Request' : 'Session Confirmed'}
        </h2>
        <div style="border: 1px solid #e5e5e5; padding: 20px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-size: 14px;"><strong>Client:</strong> ${client_name}</p>
          <p style="margin: 0 0 8px; font-size: 14px;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin: 0 0 8px; font-size: 14px;"><strong>Time:</strong> ${formattedTime}${endTime ? ` - ${endTime}` : ''}</p>
          ${rate ? `<p style="margin: 0 0 8px; font-size: 14px;"><strong>Rate:</strong> $${rate}</p>` : ''}
        </div>
        ${isRequest
          ? '<p style="font-size: 14px; color: #666;">Log in to your FitRush dashboard to accept or decline this request.</p>'
          : '<p style="font-size: 14px; color: #666;">This session has been added to your schedule. Check your dashboard for details.</p>'
        }
        <p style="font-size: 12px; color: #999; margin-top: 24px;">FitRush App</p>
      </div>
    `;

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('[notify-trainer-booking] No RESEND_API_KEY, logging instead:', {
        to: trainerUser.email,
        subject,
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
          to: [trainerUser.email],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[notify-trainer-booking] Resend error:', res.status, errBody);
      }
    }

    // Also send push notification (fire-and-forget via internal invocation)
    const pushTitle = isRequest ? 'New Booking Request' : 'New Session Booked';
    const pushBody = isRequest
      ? `${client_name} wants to book a session on ${formattedDate} at ${formattedTime}`
      : `${client_name} booked a session on ${formattedDate} at ${formattedTime}`;

    // Insert in-app notification
    const { error: notifError } = await adminClient.from('notifications').insert({
      user_id: trainer_user_id,
      type: isRequest ? 'booking_request' : 'booking_confirmed',
      title: pushTitle,
      message: pushBody,
    });
    if (notifError) console.error('[notify-trainer-booking] notification insert error:', notifError);

    // Push notification via existing edge function
    fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_ids: [trainer_user_id],
        title: pushTitle,
        body: pushBody,
        data: { type: isRequest ? 'booking_request' : 'booking_confirmed' },
      }),
    }).catch((e: unknown) => console.error('[notify-trainer-booking] push error:', e));

    return new Response(
      JSON.stringify({ success: true, email_sent_to: trainerUser.email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
