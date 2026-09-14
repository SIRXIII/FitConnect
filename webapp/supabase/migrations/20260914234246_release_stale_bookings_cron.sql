-- Cron: release slots held by abandoned webapp checkouts.
--
-- _create_booking holds the slot (availability_slots.is_booked = true) at the
-- moment the client picks it, before payment. release_pending_booking is the
-- only releaser and it hard-requires auth.uid() = client_id, so it can only run
-- from the client's own browser session. An abandoned checkout therefore held
-- the slot forever. Until 2026-09-14 this was masked by create-payment-intent-web
-- returning 500 on every booking, which always tripped BookSession's catch and
-- released the slot as a side effect.
--
-- The edge function does the Stripe-side work (cancel the PaymentIntent BEFORE
-- the booking, skip anything still payable). This just wakes it up.
--
-- Every 5 minutes: worst case a slot sits held for 35 minutes.

select cron.unschedule('release-stale-bookings')
where exists (select 1 from cron.job where jobname = 'release-stale-bookings');

select cron.schedule(
  'release-stale-bookings',
  '*/5 * * * *',
  $cmd$
  do $body$
  declare
    _key text;
  begin
    select decrypted_secret into _key from vault.decrypted_secrets
      where name = 'service_role_key' limit 1;
    if _key is null then return; end if;

    perform net.http_post(
      url     := 'https://qecwxvvlpvrnrqyrdxrj.supabase.co/functions/v1/release-stale-bookings',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _key),
      body    := '{}'::jsonb);
  end $body$;
  $cmd$
);
