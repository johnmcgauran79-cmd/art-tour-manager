ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS rendered_html text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS from_email text;
CREATE INDEX IF NOT EXISTS idx_email_logs_tour_sent_at ON public.email_logs (tour_id, sent_at DESC);