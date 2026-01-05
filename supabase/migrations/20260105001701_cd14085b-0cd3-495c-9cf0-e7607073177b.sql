-- Add tour_type field to tours table
ALTER TABLE public.tours 
ADD COLUMN tour_type text DEFAULT 'domestic';

-- Update existing international tours based on name patterns
UPDATE public.tours 
SET tour_type = 'international'
WHERE 
  LOWER(name) LIKE '%dubai%' OR
  LOWER(name) LIKE '%karaka%' OR
  LOWER(name) LIKE '%new zealand champions%' OR
  LOWER(name) LIKE '%kentucky derby%' OR
  LOWER(name) LIKE '%tabcorp%' OR
  LOWER(name) LIKE '%royal ascot%' OR
  LOWER(name) LIKE '%irish derby%' OR
  LOWER(name) LIKE '%durban july%' OR
  LOWER(name) LIKE '%palio di siena%' OR
  LOWER(name) LIKE '%japan cup%' OR
  LOWER(name) LIKE '%hong kong%';

-- Add check constraint to ensure only valid values
ALTER TABLE public.tours 
ADD CONSTRAINT tours_tour_type_check 
CHECK (tour_type IN ('domestic', 'international'));

-- Add comment for documentation
COMMENT ON COLUMN public.tours.tour_type IS 'Whether the tour is domestic (Australia) or international';