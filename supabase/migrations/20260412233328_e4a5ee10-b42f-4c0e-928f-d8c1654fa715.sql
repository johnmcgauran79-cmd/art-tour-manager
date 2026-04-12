CREATE OR REPLACE FUNCTION public.alert_new_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_passenger_name TEXT;
  v_pax_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tours WHERE id = NEW.tour_id AND alerts_enabled = true) THEN
    RETURN NEW;
  END IF;

  -- Get lead passenger name
  SELECT CONCAT(first_name, ' ', last_name) INTO v_passenger_name
  FROM customers
  WHERE id = COALESCE(NEW.lead_passenger_id, OLD.lead_passenger_id);
  
  v_passenger_name := COALESCE(v_passenger_name, 'Unknown');

  IF (TG_OP = 'INSERT') THEN
    IF NEW.status != 'cancelled' THEN
      INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, booking_id)
      VALUES (NEW.tour_id, 'new_booking', 'info',
        'New booking: ' || v_passenger_name || ' (' || NEW.passenger_count || ' pax)',
        jsonb_build_object('passenger_count', NEW.passenger_count, 'status', NEW.status, 'passenger_name', v_passenger_name),
        NEW.id);
    END IF;
  END IF;
  
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
      -- Use OLD.passenger_count since NEW already has it zeroed out
      v_pax_count := OLD.passenger_count;
      INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, booking_id)
      VALUES (NEW.tour_id, 'booking_cancelled', 'warning',
        'Booking cancelled: ' || v_passenger_name || ' (' || v_pax_count || ' pax)',
        jsonb_build_object('passenger_count', v_pax_count, 'previous_status', OLD.status, 'cancelled_at', now(), 'passenger_name', v_passenger_name),
        NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;