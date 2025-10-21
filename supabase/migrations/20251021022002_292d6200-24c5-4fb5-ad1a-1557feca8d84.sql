-- Update the tour capacity trigger function to exclude waitlist bookings
CREATE OR REPLACE FUNCTION public.update_tour_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Update the tour's passenger count (exclude cancelled and waitlist)
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND status NOT IN ('cancelled', 'waitlist')  -- Only count confirmed bookings
    )
    WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;