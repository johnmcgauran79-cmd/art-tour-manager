-- Create booking_travel_docs table to store passport details per passenger per booking
CREATE TABLE public.booking_travel_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  passenger_slot INTEGER NOT NULL CHECK (passenger_slot BETWEEN 1 AND 3), -- 1=lead, 2=pax2, 3=pax3
  name_as_per_passport TEXT,
  passport_number TEXT,
  passport_expiry_date DATE,
  passport_country TEXT,
  nationality TEXT,
  id_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (booking_id, passenger_slot)
);

-- Enable RLS
ALTER TABLE public.booking_travel_docs ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow all authenticated users to manage (internal system)
CREATE POLICY "Authenticated users can view travel docs"
  ON public.booking_travel_docs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert travel docs"
  ON public.booking_travel_docs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update travel docs"
  ON public.booking_travel_docs FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete travel docs"
  ON public.booking_travel_docs FOR DELETE
  TO authenticated
  USING (true);

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access"
  ON public.booking_travel_docs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add anon policy for public form submissions via edge functions
CREATE POLICY "Anon can insert via edge functions"
  ON public.booking_travel_docs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update via edge functions"
  ON public.booking_travel_docs FOR UPDATE
  TO anon
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_booking_travel_docs_updated_at
  BEFORE UPDATE ON public.booking_travel_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update purge_passport_data function to also clear the new table
CREATE OR REPLACE FUNCTION public.purge_passport_data()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  purged_count integer := 0;
  legacy_purged integer;
  new_table_purged integer;
BEGIN
  -- Clear legacy passport fields on bookings table where the tour ended 30+ days ago
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
  
  GET DIAGNOSTICS legacy_purged = ROW_COUNT;
  
  -- Delete rows from booking_travel_docs where the tour ended 30+ days ago
  DELETE FROM booking_travel_docs btd
  USING bookings b, tours t
  WHERE btd.booking_id = b.id
    AND b.tour_id = t.id
    AND t.end_date < (CURRENT_DATE - INTERVAL '30 days');
  
  GET DIAGNOSTICS new_table_purged = ROW_COUNT;
  
  purged_count := legacy_purged + new_table_purged;
  
  RETURN purged_count;
END;
$function$;

-- Create index for efficient lookups
CREATE INDEX idx_booking_travel_docs_booking_id ON public.booking_travel_docs(booking_id);
CREATE INDEX idx_booking_travel_docs_customer_id ON public.booking_travel_docs(customer_id);