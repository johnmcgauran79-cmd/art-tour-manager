ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS auto_tag_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];