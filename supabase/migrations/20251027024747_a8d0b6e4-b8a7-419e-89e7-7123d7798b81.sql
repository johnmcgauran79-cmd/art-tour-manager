-- Create email logs table to track all sent emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL, -- Resend message ID
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  template_name TEXT,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email events table to track delivery, opens, clicks, etc.
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id UUID REFERENCES public.email_logs(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- delivered, opened, clicked, bounced, complained
  event_data JSONB, -- Additional event data from Resend
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
CREATE POLICY "Users can view email logs for their tours"
ON public.email_logs FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'booking_agent'::app_role)
);

CREATE POLICY "System can insert email logs"
ON public.email_logs FOR INSERT
WITH CHECK (true);

-- RLS Policies for email_events
CREATE POLICY "Users can view email events"
ON public.email_events FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'booking_agent'::app_role)
);

CREATE POLICY "System can insert email events"
ON public.email_events FOR INSERT
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_email_logs_message_id ON public.email_logs(message_id);
CREATE INDEX idx_email_logs_booking_id ON public.email_logs(booking_id);
CREATE INDEX idx_email_logs_tour_id ON public.email_logs(tour_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX idx_email_events_email_log_id ON public.email_events(email_log_id);
CREATE INDEX idx_email_events_message_id ON public.email_events(message_id);
CREATE INDEX idx_email_events_event_type ON public.email_events(event_type);