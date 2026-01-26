-- Add tour_hosts_notes column to tours table
ALTER TABLE public.tours ADD COLUMN tour_hosts_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.tours.tour_hosts_notes IS 'Notes from tour hosts for future reference about changes, observations, etc.';