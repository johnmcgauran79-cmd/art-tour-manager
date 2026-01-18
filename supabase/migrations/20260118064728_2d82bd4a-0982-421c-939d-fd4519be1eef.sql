-- Table to track acknowledged email issues
-- For bounced: tracks by email address + last_bounced_at so new bounces resurface
-- For unread: tracks by email_log_id
CREATE TABLE public.email_issue_acknowledgments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_log_id UUID REFERENCES public.email_logs(id) ON DELETE CASCADE,
  email_address TEXT,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('bounced', 'complained', 'unread')),
  acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_by UUID NOT NULL,
  -- For bounced/complained: store the last bounce timestamp at time of acknowledgment
  -- If a new bounce occurs after this, the issue resurfaces
  last_event_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_issue_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view acknowledgments
CREATE POLICY "Authenticated users can view acknowledgments"
ON public.email_issue_acknowledgments
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow all authenticated users to create acknowledgments
CREATE POLICY "Authenticated users can create acknowledgments"
ON public.email_issue_acknowledgments
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to delete their own acknowledgments (or admins)
CREATE POLICY "Users can delete acknowledgments"
ON public.email_issue_acknowledgments
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Index for efficient lookups
CREATE INDEX idx_email_ack_email_address ON public.email_issue_acknowledgments(email_address) WHERE email_address IS NOT NULL;
CREATE INDEX idx_email_ack_email_log_id ON public.email_issue_acknowledgments(email_log_id) WHERE email_log_id IS NOT NULL;