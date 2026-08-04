ALTER TABLE public.tour_itineraries
  ADD COLUMN IF NOT EXISTS guest_document_file_path text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guest_document_file_name text DEFAULT NULL;