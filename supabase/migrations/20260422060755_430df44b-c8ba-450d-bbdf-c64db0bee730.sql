-- Drop the recursive policy
DROP POLICY IF EXISTS "Watchers can view tasks they watch" ON public.tasks;

-- Create a SECURITY DEFINER helper that bypasses RLS to avoid the recursion
-- (task_watchers SELECT policy references tasks, and a tasks policy that references
-- task_watchers caused infinite recursion in the policy evaluator).
CREATE OR REPLACE FUNCTION public.is_task_watcher(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_watchers
    WHERE task_id = _task_id AND user_id = _user_id
  );
$$;

-- Recreate the watcher visibility policy using the helper
CREATE POLICY "Watchers can view tasks they watch"
ON public.tasks
FOR SELECT
USING (public.is_task_watcher(auth.uid(), id));