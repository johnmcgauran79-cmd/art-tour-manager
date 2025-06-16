
-- Add new fields to the hotels table
ALTER TABLE public.hotels 
ADD COLUMN cancellation_policy TEXT,
ADD COLUMN initial_rooms_cutoff_date DATE,
ADD COLUMN final_rooms_cutoff_date DATE;
