-- 2026-08-21: Fix recurring payout integrity failure at its source.
--
-- auto_complete_past_bookings() materializes a payments row for bookings that
-- reach 'completed' without one (the mobile / escrow path; webapp bookings
-- already have a payments row from create-payment-intent-web, so the ON CONFLICT
-- DO NOTHING skips them). It was recording payments.amount = bookings.rate_charged
-- (the BASE trainer rate). But the platform's model is FEE-ON-TOP: the client is
-- charged rate + platform_fee, the trainer keeps the full rate, the platform
-- keeps the fee. Recording amount as the base rate makes the row violate the
-- payout invariant trainer_payout + platform_fee == amount, so create-payout's
-- integrity gate rejected the whole release (HTTP 400) — the exact error hit when
-- releasing Derek Salem's sessions.
--
-- Fix: record amount as the ACTUAL charge, rate_charged + platform_fee. Comp rows
-- stay 0 + 0 = 0 (still valid for is_comp). Only this one SELECT expression
-- changes; the rest of the function is unchanged.

create or replace function public.auto_complete_past_bookings()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids uuid[];
begin
  select array_agg(b.id)
    into v_ids
    from public.bookings b
    join public.availability_slots s on s.id = b.slot_id
   where b.status = 'confirmed'
     and s.start_time < now() - interval '24 hours'
     and s.start_time > now() - interval '30 days';

  if v_ids is null then
    return 0;
  end if;

  update public.bookings
     set status = 'completed',
         updated_at = now()
   where id = any(v_ids)
     and status = 'confirmed';

  insert into public.payments
        (booking_id, client_id, amount, platform_fee, trainer_payout,
         status, stripe_payment_intent_id, is_comp)
  select b.id, b.client_id,
         b.rate_charged + coalesce(b.platform_fee, 0),  -- actual charge (fee-on-top)
         b.platform_fee, b.trainer_payout,
         'succeeded', b.stripe_payment_intent_id, b.is_comp
    from public.bookings b
   where b.id = any(v_ids)
     and b.status = 'completed'
  on conflict (booking_id) do nothing;

  return coalesce(array_length(v_ids, 1), 0);
end;
$function$;
