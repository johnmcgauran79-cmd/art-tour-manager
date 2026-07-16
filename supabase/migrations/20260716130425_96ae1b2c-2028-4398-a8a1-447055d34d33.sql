
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS latest_tour_name text,
  ADD COLUMN IF NOT EXISTS latest_tour_end_date date;

CREATE OR REPLACE FUNCTION public.recompute_customer_latest_tour(_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_end date;
  v_current date;
BEGIN
  IF _customer_id IS NULL THEN RETURN; END IF;

  SELECT t.name, t.end_date
    INTO v_name, v_end
  FROM public.bookings b
  JOIN public.tours t ON t.id = b.tour_id
  WHERE b.lead_passenger_id = _customer_id
    AND b.status::text <> 'cancelled'
    AND t.end_date IS NOT NULL
    AND t.end_date < CURRENT_DATE
  ORDER BY t.end_date DESC
  LIMIT 1;

  IF v_end IS NULL THEN RETURN; END IF;

  SELECT latest_tour_end_date INTO v_current
    FROM public.customers WHERE id = _customer_id;

  IF v_current IS NULL OR v_end > v_current THEN
    UPDATE public.customers
       SET latest_tour_name = v_name,
           latest_tour_end_date = v_end,
           updated_at = now()
     WHERE id = _customer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_bookings_recompute_latest_tour()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_customer_latest_tour(OLD.lead_passenger_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_customer_latest_tour(NEW.lead_passenger_id);
  IF TG_OP = 'UPDATE' AND OLD.lead_passenger_id IS DISTINCT FROM NEW.lead_passenger_id THEN
    PERFORM public.recompute_customer_latest_tour(OLD.lead_passenger_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_recompute_latest_tour ON public.bookings;
CREATE TRIGGER bookings_recompute_latest_tour
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_bookings_recompute_latest_tour();

CREATE OR REPLACE FUNCTION public.trg_tours_recompute_latest_tour()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.end_date IS NOT DISTINCT FROM NEW.end_date
     AND OLD.name IS NOT DISTINCT FROM NEW.name THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT DISTINCT lead_passenger_id
      FROM public.bookings
     WHERE tour_id = NEW.id
       AND lead_passenger_id IS NOT NULL
  LOOP
    PERFORM public.recompute_customer_latest_tour(r.lead_passenger_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tours_recompute_latest_tour ON public.tours;
CREATE TRIGGER tours_recompute_latest_tour
AFTER UPDATE ON public.tours
FOR EACH ROW EXECUTE FUNCTION public.trg_tours_recompute_latest_tour();

-- Backfill
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT lead_passenger_id
             FROM public.bookings
            WHERE lead_passenger_id IS NOT NULL
  LOOP
    PERFORM public.recompute_customer_latest_tour(r.lead_passenger_id);
  END LOOP;
END $$;
