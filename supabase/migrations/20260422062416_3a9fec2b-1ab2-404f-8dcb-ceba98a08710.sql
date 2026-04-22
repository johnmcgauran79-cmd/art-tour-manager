-- Helper function to check if a user is a watcher on a given task (bypasses RLS recursion)
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

-- Allow watchers to view comments on tasks they watch
DROP POLICY IF EXISTS "Watchers can view comments on watched tasks" ON public.task_comments;
CREATE POLICY "Watchers can view comments on watched tasks"
ON public.task_comments
FOR SELECT
TO authenticated
USING (public.is_task_watcher(auth.uid(), task_id));

-- Allow watchers to post comments on tasks they watch
DROP POLICY IF EXISTS "Watchers can post comments on watched tasks" ON public.task_comments;
CREATE POLICY "Watchers can post comments on watched tasks"
ON public.task_comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_task_watcher(auth.uid(), task_id)
);

-- Allow watchers to view comment attachments on watched tasks
DROP POLICY IF EXISTS "Watchers can view comment attachments on watched tasks" ON public.task_comment_attachments;
CREATE POLICY "Watchers can view comment attachments on watched tasks"
ON public.task_comment_attachments
FOR SELECT
TO authenticated
USING (public.is_task_watcher(auth.uid(), task_id));

-- Allow watchers to upload comment attachments on watched tasks
DROP POLICY IF EXISTS "Watchers can upload comment attachments on watched tasks" ON public.task_comment_attachments;
CREATE POLICY "Watchers can upload comment attachments on watched tasks"
ON public.task_comment_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND public.is_task_watcher(auth.uid(), task_id)
);