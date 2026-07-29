
CREATE OR REPLACE FUNCTION public.sync_booking_passenger_names_on_customer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_name text := TRIM(CONCAT_WS(' ', NEW.first_name, NEW.last_name));
BEGIN
  IF NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN

    UPDATE public.bookings
       SET passenger_2_name = full_name
     WHERE passenger_2_id = NEW.id
       AND passenger_2_name IS DISTINCT FROM full_name;

    UPDATE public.bookings
       SET passenger_3_name = full_name
     WHERE passenger_3_id = NEW.id
       AND passenger_3_name IS DISTINCT FROM full_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_passenger_names ON public.customers;
CREATE TRIGGER trg_sync_booking_passenger_names
AFTER UPDATE OF first_name, last_name ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_passenger_names_on_customer_update();

-- One-off backfill: align existing bookings to their linked contact names
UPDATE public.bookings b
   SET passenger_2_name = TRIM(CONCAT_WS(' ', c.first_name, c.last_name))
  FROM public.customers c
 WHERE b.passenger_2_id = c.id
   AND b.passenger_2_name IS DISTINCT FROM TRIM(CONCAT_WS(' ', c.first_name, c.last_name));

UPDATE public.bookings b
   SET passenger_3_name = TRIM(CONCAT_WS(' ', c.first_name, c.last_name))
  FROM public.customers c
 WHERE b.passenger_3_id = c.id
   AND b.passenger_3_name IS DISTINCT FROM TRIM(CONCAT_WS(' ', c.first_name, c.last_name));
