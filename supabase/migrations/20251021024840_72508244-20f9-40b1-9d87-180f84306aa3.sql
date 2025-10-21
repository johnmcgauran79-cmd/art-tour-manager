-- Fix the update_tour_capacity function to use correct enum value
-- Drop the trigger first, then the function, then recreate both
DROP TRIGGER IF EXISTS trigger_update_tour_capacity ON bookings;
DROP FUNCTION IF EXISTS public.update_tour_capacity();

CREATE OR REPLACE FUNCTION public.update_tour_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    -- Update the tour's passenger count (exclude cancelled and waitlisted)
    UPDATE tours 
    SET capacity = (
        SELECT COALESCE(SUM(passenger_count), 0)
        FROM bookings 
        WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND status NOT IN ('cancelled', 'waitlisted')  -- Fixed: use 'waitlisted' not 'waitlist'
    )
    WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_update_tour_capacity
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_tour_capacity();