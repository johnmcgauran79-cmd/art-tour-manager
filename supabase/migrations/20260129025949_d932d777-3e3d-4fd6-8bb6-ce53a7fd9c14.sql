-- Add booking_id to customer_access_tokens to support booking-specific travel document requests
ALTER TABLE public.customer_access_tokens
ADD COLUMN booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE;

-- Add purpose field to distinguish between profile update and travel docs tokens
ALTER TABLE public.customer_access_tokens
ADD COLUMN purpose text DEFAULT 'profile_update';

-- Create index for efficient lookup by booking_id
CREATE INDEX idx_customer_access_tokens_booking_id ON public.customer_access_tokens(booking_id);

-- Create a function to purge passport data from bookings 30 days after tour end
CREATE OR REPLACE FUNCTION public.purge_passport_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged_count integer;
BEGIN
  -- Update bookings to clear passport fields where the tour ended 30+ days ago
  UPDATE bookings b
  SET 
    passport_number = NULL,
    passport_expiry_date = NULL,
    passport_country = NULL,
    nationality = NULL,
    id_number = NULL,
    updated_at = now()
  FROM tours t
  WHERE b.tour_id = t.id
    AND t.end_date < (CURRENT_DATE - INTERVAL '30 days')
    AND (
      b.passport_number IS NOT NULL 
      OR b.passport_expiry_date IS NOT NULL 
      OR b.passport_country IS NOT NULL 
      OR b.nationality IS NOT NULL 
      OR b.id_number IS NOT NULL
    );
  
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  
  RETURN purged_count;
END;
$$;