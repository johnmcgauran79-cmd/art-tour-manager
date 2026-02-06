-- Add separate name fields for passport details (airline requirement)
ALTER TABLE public.booking_travel_docs
ADD COLUMN passport_first_name TEXT,
ADD COLUMN passport_middle_name TEXT,
ADD COLUMN passport_surname TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN public.booking_travel_docs.passport_first_name IS 'First name as shown on passport (for airline requirements)';
COMMENT ON COLUMN public.booking_travel_docs.passport_middle_name IS 'Middle name as shown on passport (optional but encouraged)';
COMMENT ON COLUMN public.booking_travel_docs.passport_surname IS 'Surname/family name as shown on passport (for airline requirements)';