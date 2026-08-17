import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// Admin alert on every new signup, so no lead goes unnoticed.
// Called ONLY by the DB triggers in 20260805000000_notify_admin_signup.sql,
// which authenticate with the vault service_role_key.
//
// Event semantics (matches the triggers):
//   - 'client_signup' fires on profiles INSERT, i.e. on EVERY new auth user,
//     BEFORE they have chosen a role (handle_new_user defaults role='client').
//     The email therefore says "new user", not "client": claiming a role here
//     is what made one tester's single signup read as two different people.
//   - 'trainer_onboard' fires on trainer_profiles INSERT, after they chose
//     Trainer; that one genuinely knows the role.
//
// RECIPIENT / SENDER are env-overridable on purpose. Resend still has no
// verified domain on this account, so its testing sender (onboarding@resend.dev)
// may ONLY deliver to the account owner (sirxiii@gmail.com); anything else is
// rejected 403. Once a domain is verified at resend.com/domains, set:
//   ADMIN_ALERT_TO=ceofitrush@gmail.com
//   ADMIN_ALERT_FROM=FitRush Alerts <alerts@fitrush.io>
// and this function switches over with no code change.
const DEFAULT_TO = 'sirxiii@gmail.com';
const DEFAULT_FROM = 'FitRush Alerts <onboarding@resend.dev>';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type SignupEvent = 'client_signup' | 'trainer_onboard';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) return json(500, { error: 'Server misconfigured' });

    // Service-role only: a user JWT must not be able to spam the admin inbox.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (token !== serviceKey) return json(401, { error: 'Unauthorized' });

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const event: SignupEvent = b?.event === 'trainer_onboard' ? 'trainer_onboard' : 'client_signup';
    const userId = String(b?.user_id ?? '').trim();
    const email = String(b?.email ?? '').trim() || 'no email on file';
    const fullName = String(b?.full_name ?? '').trim() || 'Name not provided yet';
    const signedUpAt = String(b?.signed_up_at ?? '').trim();
    if (!userId) return json(400, { error: 'user_id is required' });

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('[notify-admin-signup] no RESEND_API_KEY; nothing sent');
      return json(200, { success: true, emailed: false });
    }

    const label = event === 'trainer_onboard' ? 'trainer' : 'signup';
    const heading = event === 'trainer_onboard' ? 'Trainer onboarded' : 'New user signed up';
    const subject = `New FitRush ${label}: ${fullName} (${email})`;
    const html =
      `<p><strong>${esc(heading)}</strong></p>` +
      `<p><strong>Name:</strong> ${esc(fullName)}<br/>` +
      `<strong>Email:</strong> ${esc(email)}<br/>` +
      `<strong>User ID:</strong> ${esc(userId)}<br/>` +
      `<strong>When:</strong> ${esc(signedUpAt)}</p>` +
      (event === 'trainer_onboard'
        ? `<p>Pending approval in the admin dashboard.</p>`
        : `<p>Role not chosen yet. You'll get a follow-up email if they onboard as a trainer.</p>`);
    const text =
      `${heading}\nName: ${fullName}\nEmail: ${email}\nUser ID: ${userId}\nWhen: ${signedUpAt}\n`;

    const to = Deno.env.get('ADMIN_ALERT_TO') || DEFAULT_TO;
    const from = Deno.env.get('ADMIN_ALERT_FROM') || DEFAULT_FROM;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[notify-admin-signup] Resend error', res.status, body);
      // Echo the provider message: this endpoint is service-role only, and a
      // silent failure here is exactly how the push-wiring bug hid for weeks.
      return json(502, { error: 'Email send failed', status: res.status, provider: body, to, from });
    }

    return json(200, { success: true, emailed: true, to, from });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
});
