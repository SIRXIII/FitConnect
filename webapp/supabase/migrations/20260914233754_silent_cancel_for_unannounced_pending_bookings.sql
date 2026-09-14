-- Cancelling a 'pending' booking must be silent.
--
-- Follow-up to 20260914185854, which stopped announcing 'pending' bookings to
-- the trainer (they are unpaid checkouts in progress, cancelled again seconds
-- later on any failure). That left the cancel side inconsistent: an abandoned
-- checkout still told the trainer that a session they had never been told
-- about was cancelled.
--
-- Nobody is notified about a pending booking, so nobody is notified when it
-- goes away. Only bookings that reached 'confirmed' produce a cancellation
-- notification, which also keeps the new release-stale-bookings reaper quiet.

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
    -- A 'pending' booking was never announced to anyone: notify_on_booking
    -- skips 'pending' inserts (migration 20260914185854). Cancelling it must
    -- therefore be silent too, or an abandoned checkout tells the trainer that
    -- a session they never heard about was cancelled.
    IF OLD.status = 'pending' THEN
      RETURN NEW;
    END IF;

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
