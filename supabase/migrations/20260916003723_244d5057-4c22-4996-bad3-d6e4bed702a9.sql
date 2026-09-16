ALTER TABLE public.tour_itineraries
  ADD COLUMN IF NOT EXISTS brochure_file_path text,
  ADD COLUMN IF NOT EXISTS brochure_file_name text,
  ADD COLUMN IF NOT EXISTS tour_itinerary_file_path text,
  ADD COLUMN IF NOT EXISTS tour_itinerary_file_name text;