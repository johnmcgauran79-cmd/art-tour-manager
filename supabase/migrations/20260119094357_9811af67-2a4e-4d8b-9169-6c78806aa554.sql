-- Add new columns to support post-booking automated emails
ALTER TABLE public.automated_email_rules 
ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'days_before_tour',
ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS status_filter text[] DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.automated_email_rules.trigger_type IS 'Type of trigger: days_before_tour or days_after_booking';
COMMENT ON COLUMN public.automated_email_rules.requires_approval IS 'Whether emails require admin approval before sending';
COMMENT ON COLUMN public.automated_email_rules.status_filter IS 'Array of booking statuses this rule applies to';

-- Create a log table for post-booking emails to track which bookings have been emailed
CREATE TABLE IF NOT EXISTS public.post_booking_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.automated_email_rules(id) ON DELETE CASCADE,
  email_log_id uuid REFERENCES public.email_logs(id),
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(booking_id, rule_id)
);

-- Enable RLS
ALTER TABLE public.post_booking_email_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read post-booking email logs
CREATE POLICY "Authenticated users can view post-booking email logs"
  ON public.post_booking_email_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert logs (service role will handle this)
CREATE POLICY "Authenticated users can insert post-booking email logs"
  ON public.post_booking_email_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_booking_email_log_booking_rule 
  ON public.post_booking_email_log(booking_id, rule_id);