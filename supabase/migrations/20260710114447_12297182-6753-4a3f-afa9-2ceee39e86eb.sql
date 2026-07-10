ALTER TABLE public.tour_itinerary_days
  ADD CONSTRAINT tour_itinerary_days_itinerary_id_fkey
  FOREIGN KEY (itinerary_id) REFERENCES public.tour_itineraries(id) ON DELETE CASCADE;

ALTER TABLE public.tour_itinerary_entries
  ADD CONSTRAINT tour_itinerary_entries_day_id_fkey
  FOREIGN KEY (day_id) REFERENCES public.tour_itinerary_days(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tour_itinerary_days_itinerary_id ON public.tour_itinerary_days(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_tour_itinerary_entries_day_id ON public.tour_itinerary_entries(day_id);