CREATE OR REPLACE FUNCTION public.alert_extra_nights()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel RECORD;
  v_passenger_name TEXT;
  v_tour_id UUID;
BEGIN
  SELECT h.name, h.default_check_in, h.default_check_out, t.alerts_enabled
  INTO v_hotel
  FROM hotels h JOIN tours t ON h.tour_id = t.id
  WHERE h.id = NEW.hotel_id;

  IF NOT v_hotel.alerts_enabled THEN
    RETURN NEW;
  END IF;

  IF NEW.check_in_date < v_hotel.default_check_in OR NEW.check_out_date > v_hotel.default_check_out THEN
    SELECT b.tour_id, COALESCE(NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), ''), 'Unknown')
    INTO v_tour_id, v_passenger_name
    FROM bookings b
    LEFT JOIN customers c ON c.id = b.lead_passenger_id
    WHERE b.id = NEW.booking_id;

    INSERT INTO tour_alerts (tour_id, alert_type, severity, message, details, booking_id, hotel_id)
    VALUES (
      v_tour_id, 'extra_nights', 'info',
      'Extra nights for ' || v_passenger_name || ' at "' || v_hotel.name || '"',
      jsonb_build_object(
        'check_in_date', NEW.check_in_date,
        'check_out_date', NEW.check_out_date,
        'default_check_in', v_hotel.default_check_in,
        'default_check_out', v_hotel.default_check_out,
        'passenger_name', v_passenger_name
      ),
      NEW.booking_id, NEW.hotel_id
    );
  END IF;

  RETURN NEW;
END;
$$;