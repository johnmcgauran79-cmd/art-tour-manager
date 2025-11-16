-- Drop existing trigger
DROP TRIGGER IF EXISTS alert_new_booking_trigger ON bookings;

-- Update function to handle both new bookings and cancellations
CREATE OR REPLACE FUNCTION public.alert_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Handle INSERT: Create alert for new bookings (non-cancelled)
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status != 'cancelled' THEN
      INSERT INTO tour_alerts (
        tour_id, alert_type, severity, message, details, booking_id
      ) VALUES (
        NEW.tour_id,
        'new_booking',
        'info',
        'New booking added for ' || NEW.passenger_count || ' passenger(s)',
        jsonb_build_object(
          'passenger_count', NEW.passenger_count,
          'status', NEW.status
        ),
        NEW.id
      );
    END IF;
  END IF;
  
  -- Handle UPDATE: Create alert when status changes to cancelled
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
      INSERT INTO tour_alerts (
        tour_id, alert_type, severity, message, details, booking_id
      ) VALUES (
        NEW.tour_id,
        'booking_cancelled',
        'warning',
        'Booking cancelled for ' || NEW.passenger_count || ' passenger(s)',
        jsonb_build_object(
          'passenger_count', NEW.passenger_count,
          'previous_status', OLD.status,
          'cancelled_at', now()
        ),
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger that fires on both INSERT and UPDATE
CREATE TRIGGER alert_new_booking_trigger
  AFTER INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION alert_new_booking();