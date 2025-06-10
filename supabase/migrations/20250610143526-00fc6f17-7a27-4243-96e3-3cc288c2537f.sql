
-- Add tour_host field to tours table
ALTER TABLE public.tours 
ADD COLUMN tour_host TEXT NOT NULL DEFAULT 'TBD';

-- Update any existing tours to have a default value
UPDATE public.tours 
SET tour_host = 'TBD' 
WHERE tour_host IS NULL;
