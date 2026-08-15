// complete-booking/index.ts — Phase B (workout-lifecycle)
//
// Trainer-driven session completion + payout-ledger write.
//
// Flow:
//   1. Auth — caller must be the booking's trainer. NOTE: bookings.trainer_id stores
//      trainer_profiles.id, NOT auth.uid(). Resolve via trainer_profiles.user_id = auth.uid()
//      (the id != user_id landmine that bites every booking edge function).
//   2. Guards — status must be 'confirmed'; the session must already have started
//      (slot.start_time <= now()) so a trainer can't pre-complete a future booking.
//   3. UPDATE bookings status='completed' (idempotent: WHERE status='confirmed').
//   4. UPSERT one payments ledger row, trainer_payout sourced VERBATIM from
//      bookings.trainer_payout (never recomputed). UNIQUE(booking_id) + ignoreDuplicates
//      makes a double-tap / retry a no-op. Self-healing on retry.
//
// Money model: DESTINATION charges already moved rate_charged to the trainer's Connect
// account at booking time. Completion does NOT move money — it makes the booking
// earnings-visible and writes the payments row that create-payout / weekly-payouts read.
// No Stripe call here.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: { user }, error: userErr } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (userErr || !user) return json({ error: 'unauthorized' }, 401)
  const callerId = user.id

  try {
    const body = await req.json().catch(() => ({}))
    const bookingId: string | undefined = body?.booking_id
    if (!bookingId || !UUID_RE.test(bookingId)) {
      return json({ error: 'booking_id must be a valid UUID' }, 400)
    }

    const { data: bk, error: bookErr } = await admin
      .from('bookings')
      .select(
        'id, client_id, trainer_id, slot_id, status, rate_charged, platform_fee, ' +
          'trainer_payout, stripe_payment_intent_id, is_comp',
      )
      .eq('id', bookingId)
      .single()
    if (bookErr || !bk) return json({ error: 'booking_not_found' }, 404)

    const { data: trainerRow } = await admin
      .from('trainer_profiles')
      .select('id')
      .eq('user_id', callerId)
      .maybeSingle()
    if (!trainerRow || trainerRow.id !== bk.trainer_id) {
      return json({ error: 'permission_denied' }, 403)
    }

    if (bk.status === 'cancelled') {
      return json({ error: 'not_completable', current_status: 'cancelled' }, 409)
    }
    if (bk.status !== 'confirmed' && bk.status !== 'completed') {
      return json({ error: 'not_completable', current_status: bk.status }, 409)
    }

    if (bk.status === 'confirmed') {
      if (bk.slot_id) {
        const { data: slot } = await admin
          .from('availability_slots')
          .select('start_time')
          .eq('id', bk.slot_id)
          .maybeSingle()
        if (slot?.start_time && new Date(slot.start_time).getTime() > Date.now()) {
          return json({ error: 'session_not_started' }, 409)
        }
      }

      const { error: updErr } = await admin
        .from('bookings')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('status', 'confirmed')
      if (updErr) return json({ error: 'status_update_failed', detail: updErr.message }, 500)
    }

    const { data: fresh } = await admin
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single()
    const finalStatus = fresh?.status ?? bk.status
    if (finalStatus !== 'completed') {
      return json({ status: finalStatus })
    }

    const { error: payErr } = await admin
      .from('payments')
      .upsert(
        {
          booking_id: bk.id,
          client_id: bk.client_id,
          amount: bk.rate_charged,
          platform_fee: bk.platform_fee,
          trainer_payout: bk.trainer_payout,
          status: 'succeeded',
          stripe_payment_intent_id: bk.stripe_payment_intent_id,
          is_comp: bk.is_comp,
        },
        { onConflict: 'booking_id', ignoreDuplicates: true },
      )
    if (payErr) {
      console.error('payments upsert failed:', payErr)
      return json({ error: 'ledger_write_failed', detail: payErr.message }, 500)
    }

    return json({
      status: 'completed',
      trainer_payout: bk.trainer_payout,
      payment_recorded: true,
    })
  } catch (err) {
    console.error('complete-booking error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})
