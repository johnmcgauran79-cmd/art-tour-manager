-- Add date_of_birth column to booking_travel_docs
ALTER TABLE public.booking_travel_docs 
ADD COLUMN date_of_birth date NULL;

-- Remove id_number column (keeping for now as we migrate, can drop later if needed)
-- We'll just stop using it in the application

COMMENT ON COLUMN public.booking_travel_docs.date_of_birth IS 'Passenger date of birth for travel documents';