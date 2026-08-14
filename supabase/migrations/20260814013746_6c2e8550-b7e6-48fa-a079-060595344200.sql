CREATE TABLE public.tour_itinerary_day_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id UUID NOT NULL REFERENCES public.tour_itinerary_days(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  wp_media_id INTEGER,
  wp_source_url TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tour_itinerary_day_images_day ON public.tour_itinerary_day_images(day_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_itinerary_day_images TO authenticated;
GRANT ALL ON public.tour_itinerary_day_images TO service_role;

ALTER TABLE public.tour_itinerary_day_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view itinerary day images"
ON public.tour_itinerary_day_images FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can insert itinerary day images"
ON public.tour_itinerary_day_images FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update itinerary day images"
ON public.tour_itinerary_day_images FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can delete itinerary day images"
ON public.tour_itinerary_day_images FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_tour_itinerary_day_images_updated_at
BEFORE UPDATE ON public.tour_itinerary_day_images
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_itinerary_day_image_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT count(*) INTO existing_count
  FROM public.tour_itinerary_day_images
  WHERE day_id = NEW.day_id;

  IF existing_count >= 3 THEN
    RAISE EXCEPTION 'An itinerary day can have a maximum of 3 photos.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_itinerary_day_image_limit
BEFORE INSERT ON public.tour_itinerary_day_images
FOR EACH ROW EXECUTE FUNCTION public.enforce_itinerary_day_image_limit();