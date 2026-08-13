ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS pickup_arrival_doc_path TEXT,
  ADD COLUMN IF NOT EXISTS pickup_arrival_doc_name TEXT;