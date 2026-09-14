-- Trainer booking notifications fire on PAYMENT, not on booking creation.
--
-- 2026-09-14 incident: create-payment-intent-web returned 500 on every webapp
-- checkout (it upserted two columns that do not exist on public.payments), so
-- BookSession.tsx released the pending booking straight away. Each failed
-- attempt sent the trainer three notifications -- "New Booking Request",
-- "New Session Booked", then "Booking Cancelled". One trainer took 12 in-app
-- notifications and up to 24 iOS pushes in 21 minutes for sessions that were
-- never paid for and never happened.
--
-- Root cause is not the 500. It is that the trainer was told about a booking
-- the moment the row was inserted, while it was still 'pending' and unpaid.
-- Any abandoned or failed checkout produced the same spam.
--
-- Fix: notify the trainer when the booking reaches 'confirmed', which is the
-- only state that means money actually moved.
--
-- Why a status guard is sufficient (public._create_booking + stripe-webhook):
--   * webapp, paid slot   -> INSERT status 'pending', flipped to 'confirmed'
--                            by stripe-webhook on payment_intent.succeeded.
--                            This is the case that was spamming. Now notified
--                            on the UPDATE instead of the INSERT.
--   * webapp, intro slot  -> INSERT status 'confirmed' ($0, no payment step).
--                            Still notified on INSERT, unchanged.
--   * mobile, slot-first  -> stripe-webhook INSERTs status 'confirmed' only
--                            after payment succeeds. Still notified on
--                            INSERT, unchanged.
--   * request mode        -> writes to booking_requests, not bookings. This
--                            trigger never fired for it. Unchanged.
--
-- No extra email here: the 'confirmed' branch already sends
-- send_email_notification('booking_confirmed', NEW.id).

CREATE OR REPLACE FUNCTION public.notify_on_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  trainer_user_id UUID;
  client_name TEXT;
BEGIN
  -- A 'pending' booking is an unpaid checkout in progress. Announcing it to
  -- the trainer is premature: it is cancelled again seconds later whenever
  -- payment fails or the client walks away. notify_on_booking_update handles
  -- the trainer notification once the booking reaches 'confirmed'.
  IF NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO trainer_user_id FROM trainer_profiles WHERE id = NEW.trainer_id;
  SELECT full_name INTO client_name FROM profiles WHERE id = NEW.client_id;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    trainer_user_id,
    'booking_requested',
    'New Booking Request',
    COALESCE(client_name, 'A client') || ' requested a session',
    '/trainer/dashboard'
  );

  PERFORM send_email_notification('booking_created', NEW.id);

  PERFORM send_booking_push(
    trainer_user_id,
    'New booking 💪',
    COALESCE(client_name, 'A client') || ' booked a session with you',
    'booking_request',
    NEW.id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_booking_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  trainer_user_id UUID;
  client_name TEXT;
  trainer_name TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO trainer_user_id FROM trainer_profiles WHERE id = NEW.trainer_id;
  SELECT full_name INTO client_name FROM profiles WHERE id = NEW.client_id;
  SELECT p.full_name INTO trainer_name FROM profiles p JOIN trainer_profiles tp ON tp.user_id = p.id WHERE tp.id = NEW.trainer_id;

  IF NEW.status = 'confirmed' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.client_id,
      'booking_confirmed',
      'Session Confirmed',
      COALESCE(trainer_name, 'Your trainer') || ' confirmed your session',
      '/client/bookings'
    );
    PERFORM send_email_notification('booking_confirmed', NEW.id);

    PERFORM send_booking_push(
      NEW.client_id,
      'Session confirmed ✅',
      COALESCE(trainer_name, 'Your trainer') || ' confirmed your session',
      'booking_confirmation',
      NEW.id
    );

    -- The trainer's single notification for a paid webapp booking. Moved here
    -- from notify_on_booking so it fires on payment, not on checkout start.
    IF OLD.status = 'pending' THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        trainer_user_id,
        'booking_confirmed',
        'New Session Booked',
        COALESCE(client_name, 'A client') || ' booked and paid for a session',
        '/trainer/dashboard'
      );

      PERFORM send_booking_push(
        trainer_user_id,
        'New booking 💪',
        COALESCE(client_name, 'A client') || ' booked a session with you',
        'booking_request',
        NEW.id
      );
    END IF;

  ELSIF NEW.status = 'cancelled' THEN
    IF NEW.cancelled_by = NEW.client_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        trainer_user_id,
        'booking_cancelled',
        'Booking Cancelled',
        COALESCE(client_name, 'A client') || ' cancelled their session',
        '/trainer/dashboard'
      );
      PERFORM send_booking_push(
        trainer_user_id,
        'Booking cancelled',
        COALESCE(client_name, 'A client') || ' cancelled their session',
        'booking_cancelled',
        NEW.id
      );
    ELSE
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        NEW.client_id,
        'booking_cancelled',
        'Session Cancelled',
        COALESCE(trainer_name, 'Your trainer') || ' cancelled the session',
        '/client/bookings'
      );
      PERFORM send_booking_push(
        NEW.client_id,
        'Session cancelled',
        COALESCE(trainer_name, 'Your trainer') || ' cancelled the session',
        'booking_cancelled',
        NEW.id
      );
    END IF;
    PERFORM send_email_notification('booking_cancelled', NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;
