
-- Fix security warnings by setting search_path for all remaining functions

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix generate_temp_password function
CREATE OR REPLACE FUNCTION public.generate_temp_password()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Generate a simple 8-character temporary password
    RETURN 'temp' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$;

-- Fix update_hotel_rooms_booked function
CREATE OR REPLACE FUNCTION public.update_hotel_rooms_booked()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = COALESCE(NEW.hotel_id, OLD.hotel_id)
        AND hb.allocated = true
        AND b.status != 'cancelled'
    )
    WHERE id = COALESCE(NEW.hotel_id, OLD.hotel_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix update_tour_capacity function
CREATE OR REPLACE FUNCTION public.update_tour_capacity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the tour's passenger count
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND status != 'cancelled'
    )
    WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix update_counts_on_booking_status_change function
CREATE OR REPLACE FUNCTION public.update_counts_on_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update hotel rooms booked
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = hotels.id
        AND hb.allocated = true
        AND b.status != 'cancelled'
    )
    WHERE id IN (
        SELECT hotel_id FROM hotel_bookings WHERE booking_id = NEW.id
    );
    
    -- Update activity spots booked
    UPDATE activities 
    SET spots_booked = (
        SELECT COALESCE(SUM(ab.passengers_attending), 0)
        FROM activity_bookings ab 
        JOIN bookings b ON ab.booking_id = b.id 
        WHERE ab.activity_id = activities.id
        AND b.status != 'cancelled'
    )
    WHERE id IN (
        SELECT activity_id FROM activity_bookings WHERE booking_id = NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix update_activity_spots_booked function
CREATE OR REPLACE FUNCTION public.update_activity_spots_booked()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE activities 
    SET spots_booked = (
        SELECT COALESCE(SUM(ab.passengers_attending), 0)
        FROM activity_bookings ab 
        JOIN bookings b ON ab.booking_id = b.id 
        WHERE ab.activity_id = COALESCE(NEW.activity_id, OLD.activity_id)
        AND b.status != 'cancelled'
    )
    WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix calculate_nights function
CREATE OR REPLACE FUNCTION public.calculate_nights(check_in date, check_out date)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF check_in IS NULL OR check_out IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN check_out - check_in;
END;
$$;

-- Fix update_hotel_booking_nights function
CREATE OR REPLACE FUNCTION public.update_hotel_booking_nights()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nights = calculate_nights(NEW.check_in_date, NEW.check_out_date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix calculate_booking_revenue function
CREATE OR REPLACE FUNCTION public.calculate_booking_revenue()
RETURNS TRIGGER AS $$
DECLARE
    tour_single_price NUMERIC;
    tour_double_price NUMERIC;
    calculated_revenue NUMERIC;
BEGIN
    -- Skip calculation if booking is cancelled
    IF NEW.status = 'cancelled' THEN
        NEW.revenue = 0;
        RETURN NEW;
    END IF;
    
    -- Get tour prices
    SELECT price_single, price_double 
    INTO tour_single_price, tour_double_price
    FROM tours 
    WHERE id = NEW.tour_id;
    
    -- Calculate revenue based on passenger count
    IF NEW.passenger_count = 1 THEN
        calculated_revenue = COALESCE(tour_single_price, 0);
    ELSE
        calculated_revenue = NEW.passenger_count * COALESCE(tour_double_price, 0);
    END IF;
    
    NEW.revenue = calculated_revenue;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
