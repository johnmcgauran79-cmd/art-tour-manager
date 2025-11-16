-- Create function to check and create hotel overbooking alerts
CREATE OR REPLACE FUNCTION public.check_hotel_oversold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if hotel is oversold
  IF NEW.rooms_booked > NEW.rooms_reserved THEN
    IF NOT EXISTS (
      SELECT 1 FROM tour_alerts 
      WHERE hotel_id = NEW.id 
      AND alert_type = 'hotel_oversold'
      AND is_acknowledged = false
    ) THEN
      INSERT INTO tour_alerts (
        tour_id, alert_type, severity, message, details, hotel_id
      ) VALUES (
        NEW.tour_id,
        'hotel_oversold',
        'warning',
        'Hotel "' || NEW.name || '" is oversold',
        jsonb_build_object(
          'rooms_reserved', NEW.rooms_reserved,
          'rooms_booked', NEW.rooms_booked,
          'oversold_by', NEW.rooms_booked - NEW.rooms_reserved
        ),
        NEW.id
      );
    END IF;
  ELSE
    -- Remove alert if capacity is now fine
    DELETE FROM tour_alerts
    WHERE hotel_id = NEW.id 
    AND alert_type = 'hotel_oversold'
    AND is_acknowledged = false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to check and create activity oversold alerts
CREATE OR REPLACE FUNCTION public.check_activity_oversold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if activity is oversold
  IF NEW.spots_booked > NEW.spots_available THEN
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM tour_alerts 
      WHERE activity_id = NEW.id 
      AND alert_type = 'activity_oversold'
      AND is_acknowledged = false
    ) THEN
      INSERT INTO tour_alerts (
        tour_id, alert_type, severity, message, details, activity_id
      ) VALUES (
        NEW.tour_id,
        'activity_oversold',
        'warning',
        'Activity "' || NEW.name || '" is oversold',
        jsonb_build_object(
          'spots_available', NEW.spots_available,
          'spots_booked', NEW.spots_booked,
          'oversold_by', NEW.spots_booked - NEW.spots_available
        ),
        NEW.id
      );
    END IF;
  ELSE
    -- Remove alert if capacity is now fine
    DELETE FROM tour_alerts
    WHERE activity_id = NEW.id 
    AND alert_type = 'activity_oversold'
    AND is_acknowledged = false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to alert on new bookings
CREATE OR REPLACE FUNCTION public.alert_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create alert for non-cancelled bookings
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
  
  RETURN NEW;
END;
$$;

-- Create function to alert on extra nights
CREATE OR REPLACE FUNCTION public.alert_extra_nights()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hotel RECORD;
  v_tour_start DATE;
  v_tour_end DATE;
BEGIN
  -- Get hotel and tour info
  SELECT h.name, h.default_check_in, h.default_check_out, t.start_date, t.end_date
  INTO v_hotel
  FROM hotels h
  JOIN tours t ON h.tour_id = t.id
  WHERE h.id = NEW.hotel_id;
  
  -- Check if dates are outside default range
  IF NEW.check_in_date < v_hotel.default_check_in OR NEW.check_out_date > v_hotel.default_check_out THEN
    INSERT INTO tour_alerts (
      tour_id, alert_type, severity, message, details, booking_id, hotel_id
    ) 
    SELECT 
      b.tour_id,
      'extra_nights',
      'info',
      'Extra nights added for booking at "' || v_hotel.name || '"',
      jsonb_build_object(
        'check_in_date', NEW.check_in_date,
        'check_out_date', NEW.check_out_date,
        'default_check_in', v_hotel.default_check_in,
        'default_check_out', v_hotel.default_check_out
      ),
      NEW.booking_id,
      NEW.hotel_id
    FROM bookings b
    WHERE b.id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS check_hotel_oversold_trigger ON hotels;
CREATE TRIGGER check_hotel_oversold_trigger
  AFTER INSERT OR UPDATE OF rooms_booked, rooms_reserved ON hotels
  FOR EACH ROW
  EXECUTE FUNCTION check_hotel_oversold();

DROP TRIGGER IF EXISTS check_activity_oversold_trigger ON activities;
CREATE TRIGGER check_activity_oversold_trigger
  AFTER INSERT OR UPDATE OF spots_booked, spots_available ON activities
  FOR EACH ROW
  EXECUTE FUNCTION check_activity_oversold();

DROP TRIGGER IF EXISTS alert_new_booking_trigger ON bookings;
CREATE TRIGGER alert_new_booking_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION alert_new_booking();

DROP TRIGGER IF EXISTS alert_extra_nights_trigger ON hotel_bookings;
CREATE TRIGGER alert_extra_nights_trigger
  AFTER INSERT OR UPDATE OF check_in_date, check_out_date ON hotel_bookings
  FOR EACH ROW
  EXECUTE FUNCTION alert_extra_nights();

-- Create function to refresh weekly capacity alerts
CREATE OR REPLACE FUNCTION public.refresh_capacity_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_alerts_created INTEGER := 0;
  v_hotel RECORD;
  v_activity RECORD;
BEGIN
  -- Check for hotels that are still oversold after being acknowledged
  FOR v_hotel IN 
    SELECT h.id, h.tour_id, h.name, h.rooms_reserved, h.rooms_booked
    FROM hotels h
    WHERE h.rooms_booked > h.rooms_reserved
    AND EXISTS (
      SELECT 1 FROM tour_alerts ta
      WHERE ta.hotel_id = h.id
      AND ta.alert_type = 'hotel_oversold'
      AND ta.is_acknowledged = true
      AND ta.acknowledged_at < NOW() - INTERVAL '7 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM tour_alerts ta
      WHERE ta.hotel_id = h.id
      AND ta.alert_type = 'hotel_oversold'
      AND ta.is_acknowledged = false
    )
  LOOP
    INSERT INTO tour_alerts (
      tour_id, alert_type, severity, message, details, hotel_id
    ) VALUES (
      v_hotel.tour_id,
      'hotel_oversold',
      'warning',
      'Hotel "' || v_hotel.name || '" is still oversold (recurring alert)',
      jsonb_build_object(
        'rooms_reserved', v_hotel.rooms_reserved,
        'rooms_booked', v_hotel.rooms_booked,
        'oversold_by', v_hotel.rooms_booked - v_hotel.rooms_reserved,
        'recurring', true
      ),
      v_hotel.id
    );
    v_alerts_created := v_alerts_created + 1;
  END LOOP;

  -- Check for activities that are still oversold after being acknowledged
  FOR v_activity IN 
    SELECT a.id, a.tour_id, a.name, a.spots_available, a.spots_booked
    FROM activities a
    WHERE a.spots_booked > a.spots_available
    AND EXISTS (
      SELECT 1 FROM tour_alerts ta
      WHERE ta.activity_id = a.id
      AND ta.alert_type = 'activity_oversold'
      AND ta.is_acknowledged = true
      AND ta.acknowledged_at < NOW() - INTERVAL '7 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM tour_alerts ta
      WHERE ta.activity_id = a.id
      AND ta.alert_type = 'activity_oversold'
      AND ta.is_acknowledged = false
    )
  LOOP
    INSERT INTO tour_alerts (
      tour_id, alert_type, severity, message, details, activity_id
    ) VALUES (
      v_activity.tour_id,
      'activity_oversold',
      'warning',
      'Activity "' || v_activity.name || '" is still oversold (recurring alert)',
      jsonb_build_object(
        'spots_available', v_activity.spots_available,
        'spots_booked', v_activity.spots_booked,
        'oversold_by', v_activity.spots_booked - v_activity.spots_available,
        'recurring', true
      ),
      v_activity.id
    );
    v_alerts_created := v_alerts_created + 1;
  END LOOP;

  RETURN v_alerts_created;
END;
$$;