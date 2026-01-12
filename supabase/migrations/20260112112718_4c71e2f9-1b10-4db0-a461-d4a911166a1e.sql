-- Add WhatsApp Group Communications field to bookings table
ALTER TABLE public.bookings 
ADD COLUMN whatsapp_group_comms boolean NOT NULL DEFAULT true;

-- Add comment explaining the field
COMMENT ON COLUMN public.bookings.whatsapp_group_comms IS 'Whether this booking should be included in the tour WhatsApp group communications';