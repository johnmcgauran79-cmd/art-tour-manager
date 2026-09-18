ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS daily_send_limit integer,
  ADD COLUMN IF NOT EXISTS ramp_sent_date date,
  ADD COLUMN IF NOT EXISTS ramp_sent_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS send_priority integer NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS campaign_recipients_queue_order_idx
  ON public.campaign_recipients (campaign_id, status, send_priority, created_at);