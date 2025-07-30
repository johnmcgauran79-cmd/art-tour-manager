-- Update activity booking functions to properly include 'host' bookings
-- Host bookings should be counted in activity spots and tour capacity

CREATE OR REPLACE FUNCTION public.update_activity_spots_booked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
            AND b.tour_id = a.tour_id  -- Only count bookings from the same tour
            AND b.status NOT IN ('cancelled')  -- Include host, pending, and all other valid statuses
        )
        WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_counts_on_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
            AND b.status NOT IN ('cancelled')  -- Include host, pending, and all other valid statuses
        )
        WHERE id IN (
            SELECT hotel_id FROM hotel_bookings WHERE booking_id = NEW.id
        );
        
        -- Update activity spots booked (only count bookings from the same tour)
        UPDATE activities 
        SET spots_booked = (
            SELECT COALESCE(SUM(ab.passengers_attending), 0)
            FROM activity_bookings ab 
            JOIN bookings b ON ab.booking_id = b.id 
            WHERE ab.activity_id = activities.id
            AND b.tour_id = activities.tour_id  -- Only count bookings from the same tour
            AND b.status NOT IN ('cancelled')  -- Include host, pending, and all other valid statuses
        )
        WHERE id IN (
            SELECT activity_id FROM activity_bookings WHERE booking_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tour_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    -- Update the tour's passenger count
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND status NOT IN ('cancelled')  -- Include host, pending, and all other valid statuses
    )
    WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;