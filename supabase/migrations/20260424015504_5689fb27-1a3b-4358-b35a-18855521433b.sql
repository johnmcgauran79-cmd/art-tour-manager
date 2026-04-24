-- 1. Tighten task visibility: only show tasks the user created, is assigned to, or is a host/watcher for.
-- (Removes the department-based broad visibility that showed tasks across the system.)
DROP POLICY IF EXISTS "Users can view tasks they created, are assigned to, or match th" ON public.tasks;

CREATE POLICY "Users can view tasks they created or are assigned to"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.task_assignments ta
    WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Tighten task_assignments INSERT: only the task creator, existing assignees, or an admin
-- can add new assignees. Self-assignment is blocked unless you fit one of those roles.
DROP POLICY IF EXISTS "Task creators and assigners can create assignments" ON public.task_assignments;

CREATE POLICY "Only creator, existing assignees, or admins can assign"
ON public.task_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = assigned_by
  AND (
    -- Task creator
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignments.task_id AND t.created_by = auth.uid()
    )
    -- Existing assignee on the same task
    OR EXISTS (
      SELECT 1 FROM public.task_assignments existing
      WHERE existing.task_id = task_assignments.task_id AND existing.user_id = auth.uid()
    )
    -- Admin (managers explicitly excluded per requirement)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3. Tighten task_assignments DELETE so the same group controls removals
-- (previously there was no explicit DELETE policy, meaning none existed = blocked for everyone).
DROP POLICY IF EXISTS "Only creator, existing assignees, or admins can unassign" ON public.task_assignments;

CREATE POLICY "Only creator, existing assignees, or admins can unassign"
ON public.task_assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignments.task_id AND t.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.task_assignments existing
    WHERE existing.task_id = task_assignments.task_id AND existing.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);