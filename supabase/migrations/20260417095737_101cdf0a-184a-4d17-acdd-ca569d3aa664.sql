CREATE OR REPLACE FUNCTION public.log_hotel_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  booking_id_val uuid;
BEGIN
  booking_id_val := COALESCE(NEW.booking_id, OLD.booking_id);

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      user_id, operation_type, table_name, record_id, details
    ) VALUES (
      auth.uid(),
      'ADD_HOTEL_TO_BOOKING',
      'bookings',
      booking_id_val,
      jsonb_build_object(
        'hotel_id', NEW.hotel_id,
        'check_in', NEW.check_in_date,
        'check_out', NEW.check_out_date,
        'bedding', NEW.bedding,
        'room_requests', NEW.room_requests
      )
    );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF OLD.check_in_date IS DISTINCT FROM NEW.check_in_date 
       OR OLD.check_out_date IS DISTINCT FROM NEW.check_out_date THEN
      changes := changes || jsonb_build_object(
        'hotel_dates', jsonb_build_object(
          'old', jsonb_build_object('check_in', OLD.check_in_date, 'check_out', OLD.check_out_date),
          'new', jsonb_build_object('check_in', NEW.check_in_date, 'check_out', NEW.check_out_date),
          'hotel_id', NEW.hotel_id
        )
      );
    END IF;

    IF OLD.bedding IS DISTINCT FROM NEW.bedding THEN
      changes := changes || jsonb_build_object(
        'bedding', jsonb_build_object('old', OLD.bedding, 'new', NEW.bedding, 'hotel_id', NEW.hotel_id)
      );
    END IF;

    IF OLD.room_requests IS DISTINCT FROM NEW.room_requests THEN
      changes := changes || jsonb_build_object(
        'room_requests', jsonb_build_object('old', OLD.room_requests, 'new', NEW.room_requests, 'hotel_id', NEW.hotel_id)
      );
    END IF;

    IF changes != '{}'::jsonb THEN
      INSERT INTO audit_log (
        user_id, operation_type, table_name, record_id, details
      ) VALUES (
        auth.uid(),
        'UPDATE_HOTEL_BOOKING',
        'bookings',
        booking_id_val,
        changes
      );
    END IF;

    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (
      user_id, operation_type, table_name, record_id, details
    ) VALUES (
      auth.uid(),
      'REMOVE_HOTEL_FROM_BOOKING',
      'bookings',
      booking_id_val,
      jsonb_build_object('hotel_id', OLD.hotel_id)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;