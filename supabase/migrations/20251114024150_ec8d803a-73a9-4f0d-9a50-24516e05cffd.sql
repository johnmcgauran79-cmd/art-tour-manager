-- Create tour_alerts table
CREATE TABLE IF NOT EXISTS public.tour_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- activity_oversold, hotel_oversold, new_booking, extra_nights, missing_info
  severity TEXT NOT NULL DEFAULT 'info', -- info, warning, critical
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_tour_alerts_tour_id ON public.tour_alerts(tour_id);
CREATE INDEX idx_tour_alerts_acknowledged ON public.tour_alerts(is_acknowledged);

-- Enable RLS
ALTER TABLE public.tour_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authorized users can view tour alerts"
ON public.tour_alerts FOR SELECT
USING (
  check_user_role(auth.uid(), 'admin') OR
  check_user_role(auth.uid(), 'manager') OR
  check_user_role(auth.uid(), 'booking_agent')
);

CREATE POLICY "Authorized users can create tour alerts"
ON public.tour_alerts FOR INSERT
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR
  check_user_role(auth.uid(), 'manager') OR
  check_user_role(auth.uid(), 'booking_agent')
);

CREATE POLICY "Authorized users can update tour alerts"
ON public.tour_alerts FOR UPDATE
USING (
  check_user_role(auth.uid(), 'admin') OR
  check_user_role(auth.uid(), 'manager') OR
  check_user_role(auth.uid(), 'booking_agent')
);

CREATE POLICY "Authorized users can delete tour alerts"
ON public.tour_alerts FOR DELETE
USING (
  check_user_role(auth.uid(), 'admin') OR
  check_user_role(auth.uid(), 'manager')
);

-- Function to create or update activity oversold alerts
CREATE OR REPLACE FUNCTION public.check_activity_oversold()
RETURNS TRIGGER AS $$
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
        'critical',
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check hotel oversold
CREATE OR REPLACE FUNCTION public.check_hotel_oversold()
RETURNS TRIGGER AS $$
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
        'critical',
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
    DELETE FROM tour_alerts
    WHERE hotel_id = NEW.id 
    AND alert_type = 'hotel_oversold'
    AND is_acknowledged = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create new booking alert
CREATE OR REPLACE FUNCTION public.alert_new_booking()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to detect extra nights
CREATE OR REPLACE FUNCTION public.alert_extra_nights()
RETURNS TRIGGER AS $$
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
      'warning',
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers
CREATE TRIGGER trigger_check_activity_oversold
AFTER INSERT OR UPDATE OF spots_booked, spots_available ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.check_activity_oversold();

CREATE TRIGGER trigger_check_hotel_oversold
AFTER INSERT OR UPDATE OF rooms_booked, rooms_reserved ON public.hotels
FOR EACH ROW
EXECUTE FUNCTION public.check_hotel_oversold();

CREATE TRIGGER trigger_alert_new_booking
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.alert_new_booking();

CREATE TRIGGER trigger_alert_extra_nights
AFTER INSERT OR UPDATE OF check_in_date, check_out_date ON public.hotel_bookings
FOR EACH ROW
EXECUTE FUNCTION public.alert_extra_nights();

-- Update timestamp trigger
CREATE TRIGGER update_tour_alerts_updated_at
BEFORE UPDATE ON public.tour_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();