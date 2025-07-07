
-- Update the tour capacity calculation function to exclude waitlisted bookings
CREATE OR REPLACE FUNCTION public.update_tour_capacity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the tour's passenger count (exclude waitlisted bookings)
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND status NOT IN ('cancelled', 'waitlisted')
    )
    WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the booking status change function to exclude waitlisted bookings from calculations
CREATE OR REPLACE FUNCTION public.update_counts_on_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Update hotel rooms booked (exclude waitlisted bookings)
        UPDATE hotels 
        SET rooms_booked = (
            SELECT COUNT(*) 
            FROM hotel_bookings hb 
            JOIN bookings b ON hb.booking_id = b.id 
            WHERE hb.hotel_id = hotels.id
            AND hb.allocated = true
            AND b.status NOT IN ('cancelled', 'waitlisted')
        )
        WHERE id IN (
            SELECT hotel_id FROM hotel_bookings WHERE booking_id = NEW.id
        );
        
        -- Update activity spots booked (exclude waitlisted bookings)
        UPDATE activities 
        SET spots_booked = (
            SELECT COALESCE(SUM(ab.passengers_attending), 0)
            FROM activity_bookings ab 
            JOIN bookings b ON ab.booking_id = b.id 
            WHERE ab.activity_id = activities.id
            AND b.tour_id = activities.tour_id
            AND b.status NOT IN ('cancelled', 'pending', 'waitlisted')
        )
        WHERE id IN (
            SELECT activity_id FROM activity_bookings WHERE booking_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the hotel rooms calculation function to exclude waitlisted bookings
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
        AND b.status NOT IN ('cancelled', 'waitlisted')
    )
    WHERE id = COALESCE(NEW.hotel_id, OLD.hotel_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the activity spots calculation function to exclude waitlisted bookings  
CREATE OR REPLACE FUNCTION public.update_activity_spots_booked()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if we have a valid activity_id
    IF COALESCE(NEW.activity_id, OLD.activity_id) IS NOT NULL THEN
        UPDATE activities 
        SET spots_booked = (
            SELECT COALESCE(SUM(ab.passengers_attending), 0)
            FROM activity_bookings ab 
            JOIN bookings b ON ab.booking_id = b.id 
            JOIN activities a ON ab.activity_id = a.id
            WHERE ab.activity_id = COALESCE(NEW.activity_id, OLD.activity_id)
            AND b.tour_id = a.tour_id
            AND b.status NOT IN ('cancelled', 'pending', 'waitlisted')
        )
        WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the booking deletion function to exclude waitlisted bookings from calculations
CREATE OR REPLACE FUNCTION public.delete_booking_simple(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tour_id uuid;
  v_hotel_ids uuid[];
  v_activity_ids uuid[];
BEGIN
  -- Get the tour_id and related IDs before deletion for cleanup
  SELECT tour_id INTO v_tour_id FROM bookings WHERE id = p_booking_id;
  
  -- Get affected hotel and activity IDs
  SELECT array_agg(DISTINCT hotel_id) INTO v_hotel_ids 
  FROM hotel_bookings WHERE booking_id = p_booking_id;
  
  SELECT array_agg(DISTINCT activity_id) INTO v_activity_ids 
  FROM activity_bookings WHERE booking_id = p_booking_id;
  
  -- Delete in correct order to avoid foreign key violations
  DELETE FROM hotel_bookings WHERE booking_id = p_booking_id;
  DELETE FROM activity_bookings WHERE booking_id = p_booking_id;
  DELETE FROM booking_comments WHERE booking_id = p_booking_id;
  DELETE FROM bookings WHERE id = p_booking_id;
  
  -- Update affected hotels (exclude waitlisted bookings)
  IF v_hotel_ids IS NOT NULL THEN
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = hotels.id
        AND hb.allocated = true
        AND b.status NOT IN ('cancelled', 'waitlisted')
    )
    WHERE id = ANY(v_hotel_ids);
  END IF;
  
  -- Update affected activities (exclude waitlisted bookings)
  IF v_activity_ids IS NOT NULL THEN
    UPDATE activities 
    SET spots_booked = (
        SELECT COALESCE(SUM(ab.passengers_attending), 0)
        FROM activity_bookings ab 
        JOIN bookings b ON ab.booking_id = b.id 
        WHERE ab.activity_id = activities.id
        AND b.status NOT IN ('cancelled', 'pending', 'waitlisted')
    )
    WHERE id = ANY(v_activity_ids);
  END IF;
  
  -- Update tour capacity (exclude waitlisted bookings)
  IF v_tour_id IS NOT NULL THEN
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = v_tour_id
        AND status NOT IN ('cancelled', 'waitlisted')
    )
    WHERE id = v_tour_id;
  END IF;
  
END;
$$;
