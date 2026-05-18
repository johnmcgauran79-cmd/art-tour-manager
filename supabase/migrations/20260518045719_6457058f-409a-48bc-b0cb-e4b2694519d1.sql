CREATE TABLE public.task_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_finished BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task statuses"
ON public.task_statuses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin/Manager can insert task statuses"
ON public.task_statuses FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update task statuses"
ON public.task_statuses FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can delete non-system task statuses"
ON public.task_statuses FOR DELETE
TO authenticated
USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) AND is_system = false);

CREATE TRIGGER update_task_statuses_updated_at
BEFORE UPDATE ON public.task_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.task_statuses (value, label, sort_order, is_finished, is_system) VALUES
  ('not_started', 'Not Started', 10, false, true),
  ('not_required', 'Not Required', 20, true, true),
  ('in_progress', 'In Progress', 30, false, true),
  ('waiting', 'Waiting', 40, false, true),
  ('awaiting_further_information', 'Awaiting Further Information', 50, false, true),
  ('with_third_party', 'With Third Party', 60, false, true),
  ('approval_required', 'Approval Required', 70, false, true),
  ('approved', 'Approved', 80, false, true),
  ('changes_needed', 'Changes Needed', 90, false, true),
  ('completed', 'Completed', 100, true, true),
  ('cancelled', 'Cancelled', 110, true, true),
  ('archived', 'Archived', 120, true, true);