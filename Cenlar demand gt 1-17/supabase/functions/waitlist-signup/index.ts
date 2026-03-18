import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

const CONFIRMATION_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; background: #FDFCFB; color: #1A1A1A; margin: 0; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto;">
    <div style="width: 40px; height: 1px; background: #C5A059; margin-bottom: 32px;"></div>
    <h1 style="font-size: 28px; font-weight: 300; letter-spacing: -0.5px; margin: 0 0 24px 0;">FitRush</h1>
    <p style="font-size: 16px; line-height: 1.7; color: #1A1A1A; margin: 0 0 16px 0;">
      Welcome to FitRush.
    </p>
    <p style="font-size: 16px; line-height: 1.7; color: #1A1A1A; margin: 0 0 32px 0;">
      You are on the early access list. We will reach out when it is time.
    </p>
    <div style="width: 40px; height: 1px; background: #C5A059; margin-bottom: 16px;"></div>
    <p style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #1A1A1A80;">
      Elite Fitness Marketplace
    </p>
  </div>
</body>
</html>`;

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
    // Parse body
    const body = await req.json().catch(() => ({})) as { email?: unknown };
    const email = body.email;

    // Validate email server-side
    if (
      !email ||
      typeof email !== 'string' ||
      email.trim().length === 0 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Create service-role client (bypasses RLS for insert)
    const supabase = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );

    // Insert into email_subscribers
    const { error: insertError } = await supabase
      .from('email_subscribers')
      .insert({ email: normalizedEmail });

    if (insertError) {
      // 23505 = unique_violation — email already registered
      // Return 200 silently to avoid revealing existing registrations
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(insertError.message);
    }

    // Send confirmation email via Resend — non-fatal if key not set
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('[waitlist-signup] No RESEND_API_KEY, skipping email (dev mode):', normalizedEmail);
    } else {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'FitRush <noreply@resend.dev>',
          to: [normalizedEmail],
          subject: 'You are on the FitRush early access list.',
          html: CONFIRMATION_EMAIL_HTML,
        }),
      });

      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        console.error('[waitlist-signup] Resend error:', emailRes.status, errBody);
        // Email failure is non-fatal — proceed to return success
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
