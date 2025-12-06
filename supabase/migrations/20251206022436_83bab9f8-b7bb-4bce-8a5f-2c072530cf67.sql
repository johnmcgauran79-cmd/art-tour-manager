-- Add recipient_filter column to automated_email_rules
ALTER TABLE public.automated_email_rules 
ADD COLUMN recipient_filter text NOT NULL DEFAULT 'all';

-- Add comment for clarity
COMMENT ON COLUMN public.automated_email_rules.recipient_filter IS 'Filter for email recipients: all, with_accommodation, without_accommodation';