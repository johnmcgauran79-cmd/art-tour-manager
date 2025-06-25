
-- First, let's fix the activity spots calculation function to be more efficient
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
            WHERE ab.activity_id = COALESCE(NEW.activity_id, OLD.activity_id)
            AND b.status NOT IN ('cancelled', 'pending')
        )
        WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the booking status change function to be more efficient
CREATE OR REPLACE FUNCTION public.update_counts_on_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Update hotel rooms booked (keep existing logic for hotels - using allocated flag)
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
        
        -- Update activity spots booked (only count non-pending and non-cancelled)
        UPDATE activities 
        SET spots_booked = (
            SELECT COALESCE(SUM(ab.passengers_attending), 0)
            FROM activity_bookings ab 
            JOIN bookings b ON ab.booking_id = b.id 
            WHERE ab.activity_id = activities.id
            AND b.status NOT IN ('cancelled', 'pending')
        )
        WHERE id IN (
            SELECT activity_id FROM activity_bookings WHERE booking_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Create a simpler function specifically for booking deletion that skips trigger updates
CREATE OR REPLACE FUNCTION public.delete_booking_simple(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable triggers during deletion to avoid timeouts
  SET session_replication_role = replica;
  
  -- Delete in correct order to avoid foreign key violations
  DELETE FROM hotel_bookings WHERE booking_id = p_booking_id;
  DELETE FROM activity_bookings WHERE booking_id = p_booking_id;
  DELETE FROM booking_comments WHERE booking_id = p_booking_id;
  DELETE FROM bookings WHERE id = p_booking_id;
  
  -- Re-enable triggers
  SET session_replication_role = DEFAULT;
  
  -- Now manually update the counts for affected activities and hotels
  -- Update activities that were affected
  UPDATE activities 
  SET spots_booked = (
      SELECT COALESCE(SUM(ab.passengers_attending), 0)
      FROM activity_bookings ab 
      JOIN bookings b ON ab.booking_id = b.id 
      WHERE ab.activity_id = activities.id
      AND b.status NOT IN ('cancelled', 'pending')
  )
  WHERE id IN (
      SELECT DISTINCT activity_id 
      FROM activity_bookings ab
      JOIN bookings b ON ab.booking_id = b.id
      WHERE b.tour_id IN (SELECT tour_id FROM bookings WHERE id = p_booking_id)
  );
  
  -- Update hotels that were affected
  UPDATE hotels 
  SET rooms_booked = (
      SELECT COUNT(*) 
      FROM hotel_bookings hb 
      JOIN bookings b ON hb.booking_id = b.id 
      WHERE hb.hotel_id = hotels.id
      AND hb.allocated = true
      AND b.status != 'cancelled'
  )
  WHERE tour_id IN (SELECT tour_id FROM bookings WHERE id = p_booking_id);
  
END;
$$;

-- Add proper indexes to improve performance
CREATE INDEX IF NOT EXISTS idx_activity_bookings_booking_id ON activity_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_activity_bookings_activity_id ON activity_bookings(activity_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_booking_id ON hotel_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_hotel_id ON hotel_bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
