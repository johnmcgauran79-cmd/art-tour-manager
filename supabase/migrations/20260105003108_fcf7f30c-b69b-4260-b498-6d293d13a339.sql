-- Update the log_booking_changes trigger function to remove references to deleted columns
CREATE OR REPLACE FUNCTION public.log_booking_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  changes jsonb := '{}'::jsonb;
  old_val text;
  new_val text;
BEGIN
  -- Log INSERT operations (booking creation)
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      user_id,
      operation_type,
      table_name,
      record_id,
      details
    ) VALUES (
      auth.uid(),
      'CREATE_BOOKING',
      'bookings',
      NEW.id,
      jsonb_build_object(
        'passenger_count', NEW.passenger_count,
        'status', NEW.status,
        'tour_id', NEW.tour_id,
        'lead_passenger_id', NEW.lead_passenger_id
      )
    );
    RETURN NEW;
  END IF;

  -- Log UPDATE operations (booking changes)
  IF (TG_OP = 'UPDATE') THEN
    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changes := changes || jsonb_build_object(
        'status', jsonb_build_object('old', OLD.status, 'new', NEW.status)
      );
    END IF;

    -- Track passenger count changes
    IF OLD.passenger_count IS DISTINCT FROM NEW.passenger_count THEN
      changes := changes || jsonb_build_object(
        'passenger_count', jsonb_build_object('old', OLD.passenger_count, 'new', NEW.passenger_count)
      );
    END IF;

    -- Track check-in date changes
    IF OLD.check_in_date IS DISTINCT FROM NEW.check_in_date THEN
      changes := changes || jsonb_build_object(
        'check_in_date', jsonb_build_object('old', OLD.check_in_date, 'new', NEW.check_in_date)
      );
    END IF;

    -- Track check-out date changes
    IF OLD.check_out_date IS DISTINCT FROM NEW.check_out_date THEN
      changes := changes || jsonb_build_object(
        'check_out_date', jsonb_build_object('old', OLD.check_out_date, 'new', NEW.check_out_date)
      );
    END IF;

    -- Track accommodation required changes
    IF OLD.accommodation_required IS DISTINCT FROM NEW.accommodation_required THEN
      changes := changes || jsonb_build_object(
        'accommodation_required', jsonb_build_object('old', OLD.accommodation_required, 'new', NEW.accommodation_required)
      );
    END IF;

    -- Track passport info changes
    IF OLD.passport_number IS DISTINCT FROM NEW.passport_number 
       OR OLD.passport_country IS DISTINCT FROM NEW.passport_country
       OR OLD.passport_expiry_date IS DISTINCT FROM NEW.passport_expiry_date THEN
      changes := changes || jsonb_build_object(
        'passport', jsonb_build_object(
          'old', jsonb_build_object('number', OLD.passport_number, 'country', OLD.passport_country, 'expiry', OLD.passport_expiry_date),
          'new', jsonb_build_object('number', NEW.passport_number, 'country', NEW.passport_country, 'expiry', NEW.passport_expiry_date)
        )
      );
    END IF;

    -- Only log if there were actual changes
    IF changes != '{}'::jsonb THEN
      INSERT INTO audit_log (
        user_id,
        operation_type,
        table_name,
        record_id,
        details
      ) VALUES (
        COALESCE(auth.uid(), OLD.id), -- Fallback to booking ID if no user context
        'UPDATE_BOOKING',
        'bookings',
        NEW.id,
        changes
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;