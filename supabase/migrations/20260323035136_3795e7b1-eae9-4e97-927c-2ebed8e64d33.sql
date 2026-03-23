ALTER TABLE public.tour_itineraries 
  ADD COLUMN snapshot_file_path text DEFAULT NULL,
  ADD COLUMN snapshot_file_name text DEFAULT NULL;