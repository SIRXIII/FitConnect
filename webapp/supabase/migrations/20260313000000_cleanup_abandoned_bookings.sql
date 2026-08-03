-- Migration: cleanup_abandoned_bookings
-- Adds a SECURITY DEFINER function that cancels stale pending bookings with no payment record.
-- Called from the stripe-webhook Edge Function on payment_intent.canceled events,
-- or invoked manually via service_role for administrative cleanup.
-- NOT exposed as a public RPC.

CREATE OR REPLACE FUNCTION public.cleanup_abandoned_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer;
BEGIN
  UPDATE public.bookings
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE
    status = 'pending'
    AND created_at < now() - interval '30 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p WHERE p.booking_id = bookings.id
    );

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;

-- Revoke public execute access — only callable via service_role or SECURITY DEFINER context
REVOKE ALL ON FUNCTION public.cleanup_abandoned_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_bookings() TO service_role;

COMMENT ON FUNCTION public.cleanup_abandoned_bookings() IS
  'Cancels pending bookings older than 30 minutes that have no associated payment record. '
  'Handles the browser-close edge case where a booking is inserted but the payment flow is never completed. '
  'Called from stripe-webhook on payment_intent.canceled; not exposed to authenticated users.';
