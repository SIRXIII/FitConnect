import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';
import { validateNomination } from './validate.ts';

// City Demand Nominations: near-anonymous "I want a FitRush trainer here"
// signal. Every submission raises that city's running demand count, which
// becomes recruiting ammunition ("14 people in Fresno are asking for a
// trainer"). No automated email to nominees. Manual outreach only.

const NOMINATION_DAILY_LIMIT = 3;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
    const body = await req.json().catch(() => ({}));
    const validated = validateNomination(body ?? {});
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = validated.data;

    // Service-role client bypasses RLS. trainer_nominations has zero
    // policies, so this is the only write path.
    const supabase = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );

    // Rate limit by hashed caller IP. Hashed (never stored raw) so the table
    // itself carries no PII beyond what the submitter chose to type in.
    // cf-connecting-ip is set by the platform to the real client IP and is
    // not spoofable by callers (verified live: client-supplied
    // x-forwarded-for values are stripped at the edge, and the last XFF hop
    // is a varying accelerator IP, so neither end of XFF is a stable key).
    // First XFF entry is the fallback since the platform rewrites the chain.
    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip =
      req.headers.get('cf-connecting-ip') ??
      (forwardedFor.split(',')[0]?.trim() || 'unknown');
    const salt = Deno.env.get('IP_HASH_SALT') ?? 'fitrush-nominate';
    const ipHash = await sha256Hex(`${ip}:${salt}`);

    // Rate-limit check, insert, and city count all happen atomically inside
    // this RPC (advisory lock per IP), closing the race where two concurrent
    // requests from the same IP could both pass the cap check.
    const { data: rpcRows, error: rpcError } = await supabase.rpc('nominate_trainer_submit', {
      p_first_name: data.first_name,
      p_city: data.city,
      p_state: data.state,
      p_nominee_name: data.nominee_name ?? null,
      p_nominee_email: data.nominee_email ?? null,
      p_nominee_phone: data.nominee_phone ?? null,
      p_ip_hash: ipHash,
      p_daily_cap: NOMINATION_DAILY_LIMIT,
    });

    if (rpcError) {
      console.error('[nominate-trainer] nominate_trainer_submit failed', rpcError);
      return new Response(JSON.stringify({ error: 'Could not save nomination' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = rpcRows?.[0];

    if (!result?.inserted) {
      // Silent drop, same philosophy as waitlist-signup's silent-23505
      // handling: no signal back to a capped caller that anything happened.
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cityCount: number | null = result.city_count ?? null;

    // Admin alert, non-fatal. A failed or skipped email must never fail the
    // request; the nomination row is already saved by this point.
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('[nominate-trainer] No RESEND_API_KEY, skipping alert email');
    } else {
      try {
        const to = Deno.env.get('ADMIN_ALERT_TO') || 'sirxiii@gmail.com';
        const from = Deno.env.get('ADMIN_ALERT_FROM') || 'FitRush Alerts <onboarding@resend.dev>';
        const countSuffix = cityCount !== null ? ` (#${cityCount})` : '';
        const subject = `New trainer demand: ${data.city}, ${data.state}${countSuffix}`;
        const nomineeLines = [
          data.nominee_name ? `Nominee name: ${esc(data.nominee_name)}<br/>` : '',
          data.nominee_email ? `Nominee email: ${esc(data.nominee_email)}<br/>` : '',
          data.nominee_phone ? `Nominee phone: ${esc(data.nominee_phone)}<br/>` : '',
        ].join('');
        const countLine =
          cityCount !== null
            ? `<strong>Running count for this city:</strong> ${cityCount}<br/>`
            : '';
        const html =
          `<p><strong>New trainer demand nomination</strong></p>` +
          `<p><strong>From:</strong> ${esc(data.first_name)}<br/>` +
          `<strong>City:</strong> ${esc(data.city)}, ${esc(data.state)}<br/>` +
          countLine +
          `</p>` +
          (nomineeLines ? `<p>${nomineeLines}</p>` : '');

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to: [to], subject, html }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          console.error('[nominate-trainer] Resend error:', emailRes.status, errBody);
        }
      } catch (emailError) {
        console.error('[nominate-trainer] Resend request failed:', emailError);
      }
    }

    return new Response(
      JSON.stringify(cityCount !== null ? { success: true, cityCount } : { success: true }),
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
