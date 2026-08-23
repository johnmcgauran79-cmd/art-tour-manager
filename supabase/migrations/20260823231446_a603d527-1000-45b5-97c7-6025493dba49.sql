ALTER TABLE public.edm_templates
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS preheader text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES public.edm_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS submit_button_text text,
  ADD COLUMN IF NOT EXISTS thank_you_heading text;

CREATE INDEX IF NOT EXISTS idx_edm_templates_parent ON public.edm_templates(parent_template_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_scheduled
  ON public.marketing_campaigns(scheduled_send_at)
  WHERE status = 'scheduled';