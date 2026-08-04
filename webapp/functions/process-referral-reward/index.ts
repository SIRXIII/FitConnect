import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const { booking_id } = await req.json() as { booking_id: string };
    if (!booking_id) return new Response(JSON.stringify({ error: 'booking_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

    // 1. Load the completed booking to get client_id and trainer_id
    const { data: booking } = await adminClient
      .from('bookings')
      .select('id, client_id, trainer_id, status')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking || booking.status !== 'completed') {
      return new Response(JSON.stringify({ skipped: 'booking not completed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Self-referral guard: defense in depth — should not happen due to DB constraint but check anyway
    if (booking.client_id === booking.trainer_id) {
      return new Response(JSON.stringify({ skipped: 'self-referral guard triggered' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Check for pending referrals for the referred user (client or trainer)
    //    Look up referral where referred_id = client_id AND status = 'pending' (client was referred)
    //    Also look up referral where referred_id = trainer_id AND status = 'pending' (trainer was referred)
    const { data: referrals } = await adminClient
      .from('referrals')
      .select('id, referrer_id, referred_id, referred_role, status, reward_type')
      .in('referred_id', [booking.client_id, booking.trainer_id])
      .eq('status', 'pending');

    if (!referrals || referrals.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no pending referrals' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Check if this is the first completed booking for each referred user
    for (const referral of referrals) {
      // Self-referral guard per referral row (defense in depth beyond DB constraint)
      if (referral.referrer_id === referral.referred_id) continue;

      const isClientReferral = referral.referred_id === booking.client_id;
      const isTrainerReferral = referral.referred_id === booking.trainer_id;

      // Count prior completed bookings for the referred user
      const completedCountQuery = isClientReferral
        ? adminClient.from('bookings').select('*', { count: 'exact', head: true }).eq('client_id', referral.referred_id).eq('status', 'completed')
        : adminClient.from('bookings').select('*', { count: 'exact', head: true }).eq('trainer_id', referral.referred_id).eq('status', 'completed');

      const { count } = await completedCountQuery;
      if ((count ?? 0) > 1) continue; // Not first completed booking (current one is already counted)

      // 4. IDEMPOTENCY: Mark referral as 'rewarded' FIRST before inserting credit
      const { data: updated } = await adminClient
        .from('referrals')
        .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
        .eq('id', referral.id)
        .eq('status', 'pending') // Only update if still pending — prevents double-reward on retry
        .select('id');
      if (!updated?.length) continue; // Row was not pending (already rewarded) — skip

      // 5a. If client was referred (referred_role = 'client') → trainer (referrer) gets $10 payout credit
      if (isClientReferral && referral.referred_role === 'client') {
        // Look up referrer's trainer_profile id
        const { data: referrerTrainerProfile } = await adminClient
          .from('trainer_profiles')
          .select('id')
          .eq('user_id', referral.referrer_id)
          .maybeSingle();

        if (referrerTrainerProfile) {
          await adminClient.from('payout_transactions').insert({
            trainer_id: referrerTrainerProfile.id,
            amount: 10.00,
            status: 'completed',
            initiated_by: 'referral',
            stripe_transfer_id: null,
          });
        }

        // Load referrer profile for notification + email
        const { data: referrerProfile } = await adminClient
          .from('profiles')
          .select('full_name, email')
          .eq('id', referral.referrer_id)
          .maybeSingle();

        const { data: referredProfile } = await adminClient
          .from('profiles')
          .select('full_name')
          .eq('id', referral.referred_id)
          .maybeSingle();

        // In-app notification
        await adminClient.from('notifications').insert({
          user_id: referral.referrer_id,
          type: 'referral_reward',
          title: 'Referral reward earned',
          message: `${referredProfile?.full_name || 'Your referral'} completed their first booking — $10 credit added to your balance.`,
          link: '/trainer/dashboard',
          read: false,
        });

        // Email (non-blocking)
        if (resendApiKey && referrerProfile?.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FitRush <noreply@resend.dev>',
              to: [referrerProfile.email],
              subject: 'Your FitRush referral reward has been applied',
              html: `<p>Great news! ${referredProfile?.full_name || 'Your referral'} completed their first FitRush session — a $10 credit has been added to your payout balance.</p>`,
            }),
          }).catch((err: unknown) => console.error('[process-referral-reward] Resend error:', err));
        }
      }

      // 5b. If trainer was referred (referred_role = 'trainer') → referring client gets $5 discount
      if (isTrainerReferral && referral.referred_role === 'trainer') {
        // The referred trainer booked a session with the referring client.
        // Only apply if this booking has the referring client as the client.
        if (booking.client_id !== referral.referrer_id) continue;

        await adminClient
          .from('profiles')
          .update({
            referral_discount_pending: true,
            referral_discount_trainer_id: null, // $5 off ANY trainer, not just this one
          })
          .eq('id', referral.referrer_id);

        // In-app notification
        const { data: referredTrainerProfile } = await adminClient
          .from('profiles')
          .select('full_name')
          .eq('id', referral.referred_id)
          .maybeSingle();

        await adminClient.from('notifications').insert({
          user_id: referral.referrer_id,
          type: 'referral_reward',
          title: 'Referral discount earned',
          message: `${referredTrainerProfile?.full_name || 'Your referred trainer'} completed a session with you — $5 off your next booking!`,
          link: '/trainers',
          read: false,
        });

        // Email for the referring client
        const { data: referrerClientProfile } = await adminClient
          .from('profiles')
          .select('full_name, email')
          .eq('id', referral.referrer_id)
          .maybeSingle();

        if (resendApiKey && referrerClientProfile?.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FitRush <noreply@resend.dev>',
              to: [referrerClientProfile.email],
              subject: 'You earned a $5 FitRush referral discount',
              html: `<p>Great news! ${referredTrainerProfile?.full_name || 'The trainer you referred'} completed a session with you — you have a $5 discount on your next booking.</p>`,
            }),
          }).catch((err: unknown) => console.error('[process-referral-reward] Resend email error:', err));
        }
      }
    }

    return new Response(JSON.stringify({ processed: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[process-referral-reward]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
