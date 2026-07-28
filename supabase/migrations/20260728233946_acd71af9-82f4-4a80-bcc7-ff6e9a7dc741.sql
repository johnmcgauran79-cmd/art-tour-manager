CREATE OR REPLACE FUNCTION public.update_activity_spots_booked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF COALESCE(NEW.activity_id, OLD.activity_id) IS NOT NULL THEN
        UPDATE activities 
        SET spots_booked = (
            SELECT COALESCE(SUM(ab.passengers_attending), 0)
            FROM activity_bookings ab 
            JOIN bookings b ON ab.booking_id = b.id 
            JOIN activities a ON ab.activity_id = a.id
            WHERE ab.activity_id = COALESCE(NEW.activity_id, OLD.activity_id)
              AND b.tour_id = a.tour_id
              AND b.status NOT IN ('cancelled', 'waitlisted')
        )
        WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recompute all current activity spots_booked to align now
UPDATE activities a
SET spots_booked = COALESCE((
  SELECT SUM(ab.passengers_attending)
  FROM activity_bookings ab
  JOIN bookings b ON b.id = ab.booking_id
  WHERE ab.activity_id = a.id
    AND b.tour_id = a.tour_id
    AND b.status NOT IN ('cancelled', 'waitlisted')
), 0);