-- Add instalment_required field to tours table
ALTER TABLE public.tours 
ADD COLUMN instalment_required boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tours.instalment_required IS 'Whether an instalment payment is required for this tour';