ALTER TABLE public.task_templates
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'tour'
    CHECK (template_type IN ('tour','standalone')),
  ADD COLUMN IF NOT EXISTS default_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS approval_policy text NOT NULL DEFAULT 'all'
    CHECK (approval_policy IN ('all','any')),
  ADD COLUMN IF NOT EXISTS default_url_reference text;

CREATE TABLE IF NOT EXISTS public.task_template_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, user_id)
);

ALTER TABLE public.task_template_approvers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view template approvers"
  ON public.task_template_approvers FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can manage template approvers"
  ON public.task_template_approvers FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));