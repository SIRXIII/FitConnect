import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';
import { resolveReferralReward, callerAuthorizedForBooking } from '../_shared/referralReward.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Auth: caller must be a party to the booking (checked below, once loaded).
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

    const { data: { user }, error: userErr } = await adminClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const callerId = user.id;

    const { booking_id } = await req.json() as { booking_id: string };
    if (!booking_id) return new Response(JSON.stringify({ error: 'booking_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 1. Load the booking to get client_id and trainer_id
    const { data: booking } = await adminClient
      .from('bookings')
      .select('id, client_id, trainer_id, status')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) {
      return new Response(JSON.stringify({ skipped: 'booking not completed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // bookings.trainer_id stores trainer_profiles.id, not the trainer's auth uid.
    // Resolve the trainer's profiles.id (user_id) once, up front, so the auth
    // check and every downstream comparison (self-referral guard, referral
    // lookup) work in the same id space as referrals.referrer_id / referred_id.
    const { data: bookingTrainerProfile } = await adminClient
      .from('trainer_profiles')
      .select('id, user_id')
      .eq('id', booking.trainer_id)
      .maybeSingle();
    const bookingTrainerUserId = bookingTrainerProfile?.user_id ?? null;

    // Only the booking's client or its trainer may trigger reward processing for it.
    if (!callerAuthorizedForBooking({ callerId, bookingClientId: booking.client_id, bookingTrainerUserId })) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (booking.status !== 'completed') {
      return new Response(JSON.stringify({ skipped: 'booking not completed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Self-referral guard: defense in depth, should not happen due to DB constraint but check anyway.
    if (bookingTrainerUserId && booking.client_id === bookingTrainerUserId) {
      return new Response(JSON.stringify({ skipped: 'self-referral guard triggered' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Check for pending referrals for the referred user (client or trainer)
    //    Look up referral where referred_id = client_id AND status = 'pending' (client was referred)
    //    Also look up referral where referred_id = trainer's profiles.id AND status = 'pending' (trainer was referred)
    const referredIds = [booking.client_id];
    if (bookingTrainerUserId) referredIds.push(bookingTrainerUserId);

    const { data: referrals } = await adminClient
      .from('referrals')
      .select('id, referrer_id, referred_id, referred_role, status, reward_type')
      .in('referred_id', referredIds)
      .eq('status', 'pending');

    if (!referrals || referrals.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no pending referrals' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Check if this is the first completed booking for each referred user
    for (const referral of referrals) {
      // Self-referral guard per referral row (defense in depth beyond DB constraint)
      if (referral.referrer_id === referral.referred_id) continue;

      const isClientReferral = referral.referred_id === booking.client_id;
      const isTrainerReferral = bookingTrainerUserId != null && referral.referred_id === bookingTrainerUserId;
      if (!isClientReferral && !isTrainerReferral) continue;

      // Count prior completed bookings for the referred user (first-booking check).
      // The trainer branch filters on booking.trainer_id (trainer_profiles.id
      // space), not referral.referred_id (profiles.id space); those are different ids.
      const completedCountQuery = isClientReferral
        ? adminClient.from('bookings').select('*', { count: 'exact', head: true }).eq('client_id', referral.referred_id).eq('status', 'completed')
        : adminClient.from('bookings').select('*', { count: 'exact', head: true }).eq('trainer_id', booking.trainer_id).eq('status', 'completed');

      const { count } = await completedCountQuery;
      if ((count ?? 0) > 1) continue; // Not first completed booking (current one is already counted)

      // Resolve whether the referrer has a trainer_profiles row before deciding
      // the reward, so the CAS below can write the correct reward_type in one shot.
      const { data: referrerTrainerProfile } = await adminClient
        .from('trainer_profiles')
        .select('id')
        .eq('user_id', referral.referrer_id)
        .maybeSingle();

      const decision = resolveReferralReward({
        matchedSide: isClientReferral ? 'client' : 'trainer',
        referredRole: referral.referred_role,
        referrerHasTrainerProfile: !!referrerTrainerProfile,
        referrerIsBookingClient: booking.client_id === referral.referrer_id,
      });

      if (decision === 'none') continue; // No reward earned; leave the referral pending.

      // 4. IDEMPOTENCY: Mark referral as 'rewarded' FIRST before granting the reward
      const { data: updated } = await adminClient
        .from('referrals')
        .update({
          status: 'rewarded',
          rewarded_at: new Date().toISOString(),
          reward_type: decision === 'trainer_payout' ? 'payout_credit' : 'booking_discount',
        })
        .eq('id', referral.id)
        .eq('status', 'pending') // Only update if still pending, prevents double-reward on retry
        .select('id');
      if (!updated?.length) continue; // Row was not pending (already rewarded), skip

      // 5a. Referred user was a client and the referrer is a trainer: $10 payout credit.
      if (decision === 'trainer_payout') {
        const { error: payoutError } = await adminClient.from('payout_transactions').insert({
          trainer_id: referrerTrainerProfile!.id,
          amount: 10.00,
          status: 'completed',
          initiated_by: 'referral',
          stripe_transfer_id: null,
        });
        if (payoutError) {
          console.error('[process-referral-reward] payout_transactions insert failed:', payoutError);
          continue; // Referral already marked rewarded; don't announce a reward that didn't persist.
        }

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
          message: `${referredProfile?.full_name || 'Your referral'} completed their first booking. $10 credit added to your balance.`,
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
              html: `<p>Great news! ${referredProfile?.full_name || 'Your referral'} completed their first FitRush session. A $10 credit has been added to your payout balance.</p>`,
            }),
          }).catch((err: unknown) => console.error('[process-referral-reward] Resend error:', err));
        }
      }

      // 5b. Referrer earns a $5 discount: either a client referred another client,
      // or a client referred a trainer and is the client on this booking.
      if (decision === 'client_discount') {
        const { error: discountError } = await adminClient
          .from('profiles')
          .update({
            referral_discount_pending: true,
            referral_discount_trainer_id: null, // $5 off ANY trainer, not just this one
          })
          .eq('id', referral.referrer_id);
        if (discountError) {
          console.error('[process-referral-reward] profiles referral_discount_pending update failed:', discountError);
          continue; // Referral already marked rewarded; don't announce a reward that didn't persist.
        }

        const { data: referredProfile } = await adminClient
          .from('profiles')
          .select('full_name')
          .eq('id', referral.referred_id)
          .maybeSingle();

        const { data: referrerProfile } = await adminClient
          .from('profiles')
          .select('full_name, email')
          .eq('id', referral.referrer_id)
          .maybeSingle();

        // In-app notification
        await adminClient.from('notifications').insert({
          user_id: referral.referrer_id,
          type: 'referral_reward',
          title: 'Referral discount earned',
          message: `${referredProfile?.full_name || 'Your referral'} completed their first booking. $5 off your next booking.`,
          link: '/trainers',
          read: false,
        });

        // Email for the referring client (non-blocking)
        if (resendApiKey && referrerProfile?.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FitRush <noreply@resend.dev>',
              to: [referrerProfile.email],
              subject: 'You earned a $5 FitRush referral discount',
              html: `<p>Great news! ${referredProfile?.full_name || 'Your referral'} completed their first booking. You have a $5 discount on your next booking.</p>`,
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
