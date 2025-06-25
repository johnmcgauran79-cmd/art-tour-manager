
-- Drop the problematic function first
DROP FUNCTION IF EXISTS public.delete_booking_simple(uuid);

-- Create a safer version that doesn't try to disable triggers
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
  
  -- Update affected hotels
  IF v_hotel_ids IS NOT NULL THEN
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = hotels.id
        AND hb.allocated = true
        AND b.status != 'cancelled'
    )
    WHERE id = ANY(v_hotel_ids);
  END IF;
  
  -- Update affected activities
  IF v_activity_ids IS NOT NULL THEN
    UPDATE activities 
    SET spots_booked = (
        SELECT COALESCE(SUM(ab.passengers_attending), 0)
        FROM activity_bookings ab 
        JOIN bookings b ON ab.booking_id = b.id 
        WHERE ab.activity_id = activities.id
        AND b.status NOT IN ('cancelled', 'pending')
    )
    WHERE id = ANY(v_activity_ids);
  END IF;
  
  -- Update tour capacity
  IF v_tour_id IS NOT NULL THEN
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = v_tour_id
        AND status != 'cancelled'
    )
    WHERE id = v_tour_id;
  END IF;
  
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_booking_simple(uuid) TO authenticated;
