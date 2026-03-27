
-- Create scheduled_emails table
CREATE TABLE public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.tours(id) ON DELETE CASCADE,
  scheduled_send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  email_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  sent_at timestamptz,
  error_message text
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can view/manage
CREATE POLICY "Authenticated users can view scheduled emails"
  ON public.scheduled_emails FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert scheduled emails"
  ON public.scheduled_emails FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update scheduled emails"
  ON public.scheduled_emails FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete scheduled emails"
  ON public.scheduled_emails FOR DELETE TO authenticated USING (true);

-- Index for efficient querying
CREATE INDEX idx_scheduled_emails_status_send_at ON public.scheduled_emails(status, scheduled_send_at);
CREATE INDEX idx_scheduled_emails_tour_id ON public.scheduled_emails(tour_id);

-- Add display_timezone setting
INSERT INTO public.general_settings (setting_key, setting_value, description)
VALUES ('display_timezone', '"Australia/Melbourne"', 'Default timezone for displaying dates and scheduling emails')
ON CONFLICT (setting_key) DO NOTHING;
