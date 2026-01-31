-- Add passenger_2_id and passenger_3_id as foreign keys to customers table
ALTER TABLE public.bookings 
ADD COLUMN passenger_2_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
ADD COLUMN passenger_3_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create index for performance on new foreign keys
CREATE INDEX idx_bookings_passenger_2_id ON public.bookings(passenger_2_id);
CREATE INDEX idx_bookings_passenger_3_id ON public.bookings(passenger_3_id);

-- Note: We'll handle migration of existing passenger_2_name/passenger_3_name data via a separate process
-- The text fields are kept for now for backwards compatibility during transition

COMMENT ON COLUMN public.bookings.passenger_2_id IS 'Reference to customer record for second passenger - receives own emails';
COMMENT ON COLUMN public.bookings.passenger_3_id IS 'Reference to customer record for third passenger - receives own emails';
COMMENT ON COLUMN public.bookings.secondary_contact_id IS 'Reference to customer who manages the booking (agent/friend) - CC''d on lead passenger emails';