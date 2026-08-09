CREATE OR REPLACE FUNCTION public.update_hotel_rooms_booked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE hotels
    SET rooms_booked = (
        SELECT COUNT(*)
        FROM hotel_bookings hb
        JOIN bookings b ON hb.booking_id = b.id
        WHERE hb.hotel_id = hotels.id
        AND hb.allocated = true
        AND b.status NOT IN ('cancelled', 'pending', 'waitlisted')
    )
    WHERE id IN (NEW.hotel_id, OLD.hotel_id);

    RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_counts_on_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE hotels
        SET rooms_booked = (
            SELECT COUNT(*)
            FROM hotel_bookings hb
            JOIN bookings b ON hb.booking_id = b.id
            WHERE hb.hotel_id = hotels.id
            AND hb.allocated = true
            AND b.status NOT IN ('cancelled', 'waitlisted')
        )
        WHERE id IN (
            SELECT hotel_id FROM hotel_bookings WHERE booking_id = NEW.id
        );

        UPDATE activities
        SET spots_booked = (
            SELECT COALESCE(SUM(ab.passengers_attending), 0)
            FROM activity_bookings ab
            JOIN bookings b ON ab.booking_id = b.id
            WHERE ab.activity_id = activities.id
            AND b.tour_id = activities.tour_id
            AND b.status NOT IN ('cancelled', 'waitlisted')
        )
        WHERE id IN (
            SELECT activity_id FROM activity_bookings WHERE booking_id = NEW.id
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- Backfill existing counts
UPDATE hotels h
SET rooms_booked = (
    SELECT COUNT(*)
    FROM hotel_bookings hb
    JOIN bookings b ON hb.booking_id = b.id
    WHERE hb.hotel_id = h.id
      AND hb.allocated = true
      AND b.status NOT IN ('cancelled', 'pending', 'waitlisted')
);

UPDATE activities a
SET spots_booked = (
    SELECT COALESCE(SUM(ab.passengers_attending), 0)
    FROM activity_bookings ab
    JOIN bookings b ON ab.booking_id = b.id
    WHERE ab.activity_id = a.id
      AND b.tour_id = a.tour_id
      AND b.status NOT IN ('cancelled', 'waitlisted')
);

UPDATE tours t
SET capacity = (
    SELECT COALESCE(SUM(passenger_count), 0)
    FROM bookings b
    WHERE b.tour_id = t.id
      AND b.status NOT IN ('cancelled', 'waitlisted')
);