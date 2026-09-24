ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS source_template_id uuid,
  ADD COLUMN IF NOT EXISTS source_template_name text,
  ADD COLUMN IF NOT EXISTS source_template_copied_at timestamptz;