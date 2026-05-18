
-- Approver decision enum
DO $$ BEGIN
  CREATE TYPE public.task_approval_decision AS ENUM ('pending', 'approved', 'changes_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.task_approvers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  requested_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision public.task_approval_decision NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS task_approvers_task_id_idx ON public.task_approvers(task_id);
CREATE INDEX IF NOT EXISTS task_approvers_user_id_idx ON public.task_approvers(user_id);

ALTER TABLE public.task_approvers ENABLE ROW LEVEL SECURITY;

-- View: any authenticated user that can see the task (RLS on tasks will gate via existence)
CREATE POLICY "Authenticated can view task approvers"
ON public.task_approvers FOR SELECT
TO authenticated
USING (true);

-- Insert: admin, manager, task creator, or existing assignee on the task
CREATE POLICY "Privileged users can add task approvers"
ON public.task_approvers FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.task_assignments ta WHERE ta.task_id = task_approvers.task_id AND ta.user_id = auth.uid())
);

-- Update: the approver themselves recording their decision, or admin/manager
CREATE POLICY "Approver or admin can update decision"
ON public.task_approvers FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

-- Delete: admin/manager/creator
CREATE POLICY "Privileged users can remove task approvers"
ON public.task_approvers FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE TRIGGER update_task_approvers_updated_at
BEFORE UPDATE ON public.task_approvers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- When an approver's decision changes, log activity and update task status when appropriate
CREATE OR REPLACE FUNCTION public.handle_task_approver_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_approved INT;
  v_changes INT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.decision IS DISTINCT FROM OLD.decision THEN
    NEW.decided_at := now();

    PERFORM public.log_task_activity(
      NEW.task_id,
      'approval_decision',
      jsonb_build_object('user_id', NEW.user_id, 'decision', OLD.decision),
      jsonb_build_object('user_id', NEW.user_id, 'decision', NEW.decision),
      COALESCE(NEW.notes, NULL)
    );

    -- Auto-update task status:
    --  - any "changes_requested" => task moves to changes_needed
    --  - all approvers approved  => task moves to approved
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE decision = 'approved'),
      COUNT(*) FILTER (WHERE decision = 'changes_requested')
    INTO v_total, v_approved, v_changes
    FROM public.task_approvers
    WHERE task_id = NEW.task_id
      AND id <> NEW.id;

    -- Include the NEW row's decision
    v_total := v_total + 1;
    IF NEW.decision = 'approved' THEN v_approved := v_approved + 1; END IF;
    IF NEW.decision = 'changes_requested' THEN v_changes := v_changes + 1; END IF;

    IF v_changes > 0 THEN
      UPDATE public.tasks SET status = 'changes_needed' WHERE id = NEW.task_id AND status = 'approval_required';
    ELSIF v_approved = v_total THEN
      UPDATE public.tasks SET status = 'approved' WHERE id = NEW.task_id AND status = 'approval_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_approvers_decision_trigger ON public.task_approvers;
CREATE TRIGGER task_approvers_decision_trigger
BEFORE UPDATE ON public.task_approvers
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_approver_decision();
