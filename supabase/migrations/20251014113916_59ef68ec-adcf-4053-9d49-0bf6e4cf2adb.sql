-- Add secondary_contact_id to bookings table
ALTER TABLE public.bookings 
ADD COLUMN secondary_contact_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_bookings_secondary_contact ON public.bookings(secondary_contact_id);

COMMENT ON COLUMN public.bookings.secondary_contact_id IS 'Optional secondary contact who will also receive booking communications';