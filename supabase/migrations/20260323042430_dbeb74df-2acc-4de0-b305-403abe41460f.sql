-- Add alerts_enabled and alerts_manually_overridden columns to tours
ALTER TABLE public.tours 
  ADD COLUMN alerts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN alerts_manually_overridden boolean NOT NULL DEFAULT false;

-- Update check_activity_oversold to respect alerts_enabled
CREATE OR REPLACE FUNCTION public.check_activity_oversold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tours WHERE id = NEW.tour_id AND alerts_enabled = true) THEN
    RETURN NEW;
  END IF;

  IF NEW.spots_booked > NEW.spots_available THEN
    IF NOT EXISTS (
      SELECT 1 FROM tour_alerts 
      WHERE activity_id = NEW.id 
      AND alert_type = 'activity_oversold'
      AND is_acknowledged = false
    ) THEN
      INSERT INTO tour_alerts (
        tour_id, alert_type, severity, message, details, activity_id
      ) VALUES (
        NEW.tour_id, 'activity_oversold', 'warning',
        'Activity "' || NEW.name || '" is oversold',
        jsonb_build_object('spots_available', NEW.spots_available, 'spots_booked', NEW.spots_booked, 'oversold_by', NEW.spots_booked - NEW.spots_available),
        NEW.id
      );
    END IF;
  ELSE
    DELETE FROM tour_alerts WHERE activity_id = NEW.id AND alert_type = 'activity_oversold' AND is_acknowledged = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Update check_hotel_oversold to respect alerts_enabled
CREATE OR REPLACE FUNCTION public.check_hotel_oversold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tours WHERE id = NEW.tour_id AND alerts_enabled = true) THEN
    RETURN NEW;
  END IF;

  IF NEW.rooms_booked > NEW.rooms_reserved THEN
    IF NOT EXISTS (
      SELECT 1 FROM tour_alerts WHERE hotel_id = NEW.id AND alert_type = 'hotel_oversold' AND is_acknowledged = false
    ) THEN
      INSERT INTO tour_alerts (
        tour_id, alert_type, severity, message, details, hotel_id
      ) VALUES (
        NEW.tour_id, 'hotel_oversold', 'warning',
        'Hotel "' || NEW.name || '" is oversold',
        jsonb_build_object('rooms_reserved', NEW.rooms_reserved, 'rooms_booked', NEW.rooms_booked, 'oversold_by', NEW.rooms_booked - NEW.rooms_reserved),
        NEW.id
      );
    END IF;
  ELSE
    DELETE FROM tour_alerts WHERE hotel_id = NEW.id AND alert_type = 'hotel_oversold' AND is_acknowledged = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Update alert_new_booking to respect alerts_enabled
CREATE OR REPLACE FUNCTION public.alert_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tours WHERE id = NEW.tour_id AND alerts_enabled = true) THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT') THEN
    IF NEW.status != 'cancelled' THEN
      INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, booking_id)
      VALUES (NEW.tour_id, 'new_booking', 'info',
        'New booking added for ' || NEW.passenger_count || ' passenger(s)',
        jsonb_build_object('passenger_count', NEW.passenger_count, 'status', NEW.status),
        NEW.id);
    END IF;
  END IF;
  
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
      INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, booking_id)
      VALUES (NEW.tour_id, 'booking_cancelled', 'warning',
        'Booking cancelled for ' || NEW.passenger_count || ' passenger(s)',
        jsonb_build_object('passenger_count', NEW.passenger_count, 'previous_status', OLD.status, 'cancelled_at', now()),
        NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update alert_extra_nights to respect alerts_enabled
CREATE OR REPLACE FUNCTION public.alert_extra_nights()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hotel RECORD;
BEGIN
  SELECT h.name, h.default_check_in, h.default_check_out, t.alerts_enabled
  INTO v_hotel
  FROM hotels h JOIN tours t ON h.tour_id = t.id
  WHERE h.id = NEW.hotel_id;
  
  IF NOT v_hotel.alerts_enabled THEN
    RETURN NEW;
  END IF;
  
  IF NEW.check_in_date < v_hotel.default_check_in OR NEW.check_out_date > v_hotel.default_check_out THEN
    INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, booking_id, hotel_id)
    SELECT b.tour_id, 'extra_nights', 'info',
      'Extra nights added for booking at "' || v_hotel.name || '"',
      jsonb_build_object('check_in_date', NEW.check_in_date, 'check_out_date', NEW.check_out_date, 'default_check_in', v_hotel.default_check_in, 'default_check_out', v_hotel.default_check_out),
      NEW.booking_id, NEW.hotel_id
    FROM bookings b WHERE b.id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update refresh_capacity_alerts to auto-enable and respect alerts_enabled
CREATE OR REPLACE FUNCTION public.refresh_capacity_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alerts_created INTEGER := 0;
  v_hotel RECORD;
  v_activity RECORD;
BEGIN
  -- Auto-enable alerts for tours within 6 months that haven't been manually overridden
  UPDATE tours
  SET alerts_enabled = true
  WHERE alerts_enabled = false
    AND alerts_manually_overridden = false
    AND start_date <= CURRENT_DATE + INTERVAL '180 days'
    AND start_date >= CURRENT_DATE
    AND status NOT IN ('past', 'archived', 'cancelled');

  FOR v_hotel IN 
    SELECT h.id, h.tour_id, h.name, h.rooms_reserved, h.rooms_booked
    FROM hotels h JOIN tours t ON h.tour_id = t.id
    WHERE t.alerts_enabled = true
    AND h.rooms_booked > h.rooms_reserved
    AND EXISTS (SELECT 1 FROM tour_alerts ta WHERE ta.hotel_id = h.id AND ta.alert_type = 'hotel_oversold' AND ta.is_acknowledged = true AND ta.acknowledged_at < NOW() - INTERVAL '7 days')
    AND NOT EXISTS (SELECT 1 FROM tour_alerts ta WHERE ta.hotel_id = h.id AND ta.alert_type = 'hotel_oversold' AND ta.is_acknowledged = false)
  LOOP
    INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, hotel_id)
    VALUES (v_hotel.tour_id, 'hotel_oversold', 'warning',
      'Hotel "' || v_hotel.name || '" is still oversold (recurring alert)',
      jsonb_build_object('rooms_reserved', v_hotel.rooms_reserved, 'rooms_booked', v_hotel.rooms_booked, 'oversold_by', v_hotel.rooms_booked - v_hotel.rooms_reserved, 'recurring', true),
      v_hotel.id);
    v_alerts_created := v_alerts_created + 1;
  END LOOP;

  FOR v_activity IN 
    SELECT a.id, a.tour_id, a.name, a.spots_available, a.spots_booked
    FROM activities a JOIN tours t ON a.tour_id = t.id
    WHERE t.alerts_enabled = true
    AND a.spots_booked > a.spots_available
    AND EXISTS (SELECT 1 FROM tour_alerts ta WHERE ta.activity_id = a.id AND ta.alert_type = 'activity_oversold' AND ta.is_acknowledged = true AND ta.acknowledged_at < NOW() - INTERVAL '7 days')
    AND NOT EXISTS (SELECT 1 FROM tour_alerts ta WHERE ta.activity_id = a.id AND ta.alert_type = 'activity_oversold' AND ta.is_acknowledged = false)
  LOOP
    INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, activity_id)
    VALUES (v_activity.tour_id, 'activity_oversold', 'warning',
      'Activity "' || v_activity.name || '" is still oversold (recurring alert)',
      jsonb_build_object('spots_available', v_activity.spots_available, 'spots_booked', v_activity.spots_booked, 'oversold_by', v_activity.spots_booked - v_activity.spots_available, 'recurring', true),
      v_activity.id);
    v_alerts_created := v_alerts_created + 1;
  END LOOP;

  RETURN v_alerts_created;
END;
$$;
