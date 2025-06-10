
-- Create activity_bookings table to track which activities each booking is attending
CREATE TABLE IF NOT EXISTS activity_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  passengers_attending INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(booking_id, activity_id)
);

-- Add trigger to update activities spots_booked when activity_bookings change
CREATE OR REPLACE FUNCTION update_activity_spots_booked()
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
$$ LANGUAGE plpgsql;

-- Create triggers for activity_bookings table
DROP TRIGGER IF EXISTS trigger_update_activity_spots_booked ON activity_bookings;
CREATE TRIGGER trigger_update_activity_spots_booked
    AFTER INSERT OR UPDATE OR DELETE ON activity_bookings
    FOR EACH ROW EXECUTE FUNCTION update_activity_spots_booked();

-- Add trigger to update activity spots when booking status changes
CREATE OR REPLACE FUNCTION update_counts_on_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update hotel rooms booked
    UPDATE hotels 
    SET rooms_booked = (
        SELECT COUNT(*) 
        FROM hotel_bookings hb 
        JOIN bookings b ON hb.booking_id = b.id 
        WHERE hb.hotel_id = hotels.id
        AND hb.required = true
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
$$ LANGUAGE plpgsql;

-- Create trigger for booking status changes
DROP TRIGGER IF EXISTS trigger_update_counts_on_booking_status_change ON bookings;
CREATE TRIGGER trigger_update_counts_on_booking_status_change
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_counts_on_booking_status_change();

-- Enable RLS on activity_bookings table
ALTER TABLE activity_bookings ENABLE ROW LEVEL SECURITY;
