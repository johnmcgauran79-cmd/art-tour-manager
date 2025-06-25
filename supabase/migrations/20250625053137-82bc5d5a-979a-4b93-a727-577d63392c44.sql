
-- Update the function that calculates activity spots booked to only count non-pending and non-cancelled bookings
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
        AND b.status != 'pending'
    )
    WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update the function that handles booking status changes to use the same logic
CREATE OR REPLACE FUNCTION public.update_counts_on_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
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
        AND b.status != 'cancelled'
        AND b.status != 'pending'
    )
    WHERE id IN (
        SELECT activity_id FROM activity_bookings WHERE booking_id = NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
