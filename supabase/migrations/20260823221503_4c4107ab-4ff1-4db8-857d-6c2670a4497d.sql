ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'interest',
  ADD COLUMN IF NOT EXISTS tour_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS success_redirect_url text,
  ADD COLUMN IF NOT EXISTS notify_teams boolean NOT NULL DEFAULT true;

ALTER TABLE public.landing_page_submissions
  ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'interest',
  ADD COLUMN IF NOT EXISTS tour_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_landing_page_submissions_task ON public.landing_page_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_submissions_customer ON public.landing_page_submissions(customer_id);