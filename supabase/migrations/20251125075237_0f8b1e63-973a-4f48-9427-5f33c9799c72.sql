-- Create trigger function to log booking changes
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
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

    -- Track dietary restrictions changes
    IF OLD.dietary_restrictions IS DISTINCT FROM NEW.dietary_restrictions THEN
      changes := changes || jsonb_build_object(
        'dietary_restrictions', jsonb_build_object('old', OLD.dietary_restrictions, 'new', NEW.dietary_restrictions)
      );
    END IF;

    -- Track medical conditions changes
    IF OLD.medical_conditions IS DISTINCT FROM NEW.medical_conditions THEN
      changes := changes || jsonb_build_object(
        'medical_conditions', jsonb_build_object('old', OLD.medical_conditions, 'new', NEW.medical_conditions)
      );
    END IF;

    -- Track accessibility needs changes
    IF OLD.accessibility_needs IS DISTINCT FROM NEW.accessibility_needs THEN
      changes := changes || jsonb_build_object(
        'accessibility_needs', jsonb_build_object('old', OLD.accessibility_needs, 'new', NEW.accessibility_needs)
      );
    END IF;

    -- Track emergency contact changes
    IF OLD.emergency_contact_name IS DISTINCT FROM NEW.emergency_contact_name 
       OR OLD.emergency_contact_phone IS DISTINCT FROM NEW.emergency_contact_phone THEN
      changes := changes || jsonb_build_object(
        'emergency_contact', jsonb_build_object(
          'old', jsonb_build_object('name', OLD.emergency_contact_name, 'phone', OLD.emergency_contact_phone),
          'new', jsonb_build_object('name', NEW.emergency_contact_name, 'phone', NEW.emergency_contact_phone)
        )
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for booking changes
DROP TRIGGER IF EXISTS booking_audit_trail ON bookings;
CREATE TRIGGER booking_audit_trail
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_booking_changes();

-- Create trigger function to log hotel booking changes
CREATE OR REPLACE FUNCTION log_hotel_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  booking_id_val uuid;
BEGIN
  booking_id_val := COALESCE(NEW.booking_id, OLD.booking_id);

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      user_id,
      operation_type,
      table_name,
      record_id,
      details
    ) VALUES (
      auth.uid(),
      'ADD_HOTEL_TO_BOOKING',
      'bookings',
      booking_id_val,
      jsonb_build_object(
        'hotel_id', NEW.hotel_id,
        'check_in', NEW.check_in_date,
        'check_out', NEW.check_out_date,
        'bedding', NEW.bedding
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

    IF changes != '{}'::jsonb THEN
      INSERT INTO audit_log (
        user_id,
        operation_type,
        table_name,
        record_id,
        details
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
      user_id,
      operation_type,
      table_name,
      record_id,
      details
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

-- Create trigger for hotel booking changes
DROP TRIGGER IF EXISTS hotel_booking_audit_trail ON hotel_bookings;
CREATE TRIGGER hotel_booking_audit_trail
  AFTER INSERT OR UPDATE OR DELETE ON hotel_bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_hotel_booking_changes();

-- Create trigger function to log activity booking changes
CREATE OR REPLACE FUNCTION log_activity_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  booking_id_val uuid;
BEGIN
  booking_id_val := COALESCE(NEW.booking_id, OLD.booking_id);

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      user_id,
      operation_type,
      table_name,
      record_id,
      details
    ) VALUES (
      auth.uid(),
      'ADD_ACTIVITY_TO_BOOKING',
      'bookings',
      booking_id_val,
      jsonb_build_object(
        'activity_id', NEW.activity_id,
        'passengers_attending', NEW.passengers_attending
      )
    );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF OLD.passengers_attending IS DISTINCT FROM NEW.passengers_attending THEN
      changes := changes || jsonb_build_object(
        'passengers_attending', jsonb_build_object(
          'old', OLD.passengers_attending,
          'new', NEW.passengers_attending,
          'activity_id', NEW.activity_id
        )
      );
    END IF;

    IF changes != '{}'::jsonb THEN
      INSERT INTO audit_log (
        user_id,
        operation_type,
        table_name,
        record_id,
        details
      ) VALUES (
        auth.uid(),
        'UPDATE_ACTIVITY_BOOKING',
        'bookings',
        booking_id_val,
        changes
      );
    END IF;

    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (
      user_id,
      operation_type,
      table_name,
      record_id,
      details
    ) VALUES (
      auth.uid(),
      'REMOVE_ACTIVITY_FROM_BOOKING',
      'bookings',
      booking_id_val,
      jsonb_build_object('activity_id', OLD.activity_id)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for activity booking changes
DROP TRIGGER IF EXISTS activity_booking_audit_trail ON activity_bookings;
CREATE TRIGGER activity_booking_audit_trail
  AFTER INSERT OR UPDATE OR DELETE ON activity_bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_activity_booking_changes();