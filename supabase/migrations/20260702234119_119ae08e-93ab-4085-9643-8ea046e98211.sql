CREATE OR REPLACE FUNCTION public.update_hotel_rooms_booked()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Recalculate the affected hotel(s). On UPDATE the hotel_id may change,
    -- so recompute both the old and new hotel to keep counts accurate.
    UPDATE hotels
    SET rooms_booked = (
        SELECT COUNT(*)
        FROM hotel_bookings hb
        JOIN bookings b ON hb.booking_id = b.id
        WHERE hb.hotel_id = hotels.id
        AND hb.allocated = true
        AND b.status NOT IN ('cancelled', 'pending')
    )
    WHERE id IN (NEW.hotel_id, OLD.hotel_id);

    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Resync all existing hotels to correct any stale counts (e.g. The Hari at 37 -> 25)
UPDATE hotels
SET rooms_booked = (
    SELECT COUNT(*)
    FROM hotel_bookings hb
    JOIN bookings b ON hb.booking_id = b.id
    WHERE hb.hotel_id = hotels.id
    AND hb.allocated = true
    AND b.status NOT IN ('cancelled', 'pending')
);