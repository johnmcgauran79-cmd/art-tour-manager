ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS task_assignee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS task_watcher_ids uuid[] NOT NULL DEFAULT '{}';