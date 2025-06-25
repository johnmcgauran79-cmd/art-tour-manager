
-- Add enhanced booking fields for payment tracking, emergency contacts, and travel details
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_paid boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_paid_date date;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_amount numeric;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS instalment_paid boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS instalment_paid_date date;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS instalment_amount numeric;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS final_payment_paid boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS final_payment_paid_date date;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS final_payment_amount numeric;

-- Emergency contact information
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;

-- Passport/ID details for international tours
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passport_number text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passport_expiry_date date;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passport_country text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS nationality text;

-- Medical conditions and accessibility needs
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS medical_conditions text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS accessibility_needs text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS dietary_restrictions text;

-- Create booking comments table for communication log (similar to task comments)
CREATE TABLE IF NOT EXISTS public.booking_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_internal boolean DEFAULT false,
  comment_type text DEFAULT 'general'
);

-- Add RLS policies for booking comments
ALTER TABLE public.booking_comments ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing booking comments (users who can view bookings can view comments)
CREATE POLICY "Users can view booking comments" 
  ON public.booking_comments 
  FOR SELECT 
  USING (true);

-- Create policy for creating booking comments
CREATE POLICY "Users can create booking comments" 
  ON public.booking_comments 
  FOR INSERT 
  WITH CHECK (true);

-- Create policy for updating booking comments (only comment author)
CREATE POLICY "Users can update their own booking comments" 
  ON public.booking_comments 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy for deleting booking comments (only comment author or admin)
CREATE POLICY "Users can delete their own booking comments" 
  ON public.booking_comments 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Add trigger to update booking updated_at when comments are added
CREATE OR REPLACE FUNCTION update_booking_on_comment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE bookings 
    SET updated_at = now() 
    WHERE id = NEW.booking_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_booking_timestamp_on_comment
    AFTER INSERT ON booking_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_on_comment();
