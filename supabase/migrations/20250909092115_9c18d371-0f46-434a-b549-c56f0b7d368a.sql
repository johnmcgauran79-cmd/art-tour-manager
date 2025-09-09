-- Create function to update booking dates from hotel bookings
CREATE OR REPLACE FUNCTION public.update_booking_dates_from_hotels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    earliest_check_in DATE;
    latest_check_out DATE;
    target_booking_id UUID;
BEGIN
    -- Get the booking_id from either NEW or OLD record
    target_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);
    
    -- Skip if no booking_id
    IF target_booking_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate earliest check-in and latest check-out from all hotel bookings for this booking
    SELECT 
        MIN(hb.check_in_date),
        MAX(hb.check_out_date)
    INTO 
        earliest_check_in,
        latest_check_out
    FROM hotel_bookings hb
    WHERE hb.booking_id = target_booking_id
    AND hb.check_in_date IS NOT NULL 
    AND hb.check_out_date IS NOT NULL;
    
    -- Update the booking with calculated dates
    UPDATE bookings 
    SET 
        check_in_date = earliest_check_in,
        check_out_date = latest_check_out,
        total_nights = CASE 
            WHEN earliest_check_in IS NOT NULL AND latest_check_out IS NOT NULL 
            THEN latest_check_out - earliest_check_in
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = target_booking_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create triggers to automatically update booking dates when hotel bookings change
DROP TRIGGER IF EXISTS trigger_update_booking_dates_on_hotel_booking_insert ON hotel_bookings;
CREATE TRIGGER trigger_update_booking_dates_on_hotel_booking_insert
    AFTER INSERT ON hotel_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_dates_from_hotels();

DROP TRIGGER IF EXISTS trigger_update_booking_dates_on_hotel_booking_update ON hotel_bookings;
CREATE TRIGGER trigger_update_booking_dates_on_hotel_booking_update
    AFTER UPDATE ON hotel_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_dates_from_hotels();

DROP TRIGGER IF EXISTS trigger_update_booking_dates_on_hotel_booking_delete ON hotel_bookings;
CREATE TRIGGER trigger_update_booking_dates_on_hotel_booking_delete
    AFTER DELETE ON hotel_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_dates_from_hotels();

-- Update existing bookings to have correct dates
WITH booking_dates AS (
    SELECT 
        b.id as booking_id,
        MIN(hb.check_in_date) as earliest_check_in,
        MAX(hb.check_out_date) as latest_check_out
    FROM bookings b
    LEFT JOIN hotel_bookings hb ON b.id = hb.booking_id
    WHERE hb.check_in_date IS NOT NULL AND hb.check_out_date IS NOT NULL
    GROUP BY b.id
)
UPDATE bookings 
SET 
    check_in_date = bd.earliest_check_in,
    check_out_date = bd.latest_check_out,
    total_nights = CASE 
        WHEN bd.earliest_check_in IS NOT NULL AND bd.latest_check_out IS NOT NULL 
        THEN bd.latest_check_out - bd.earliest_check_in
        ELSE NULL 
    END,
    updated_at = now()
FROM booking_dates bd
WHERE bookings.id = bd.booking_id;