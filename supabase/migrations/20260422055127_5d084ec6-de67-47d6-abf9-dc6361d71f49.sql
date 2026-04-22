-- Allow task watchers to view tasks they are watching
CREATE POLICY "Watchers can view tasks they watch"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_watchers
    WHERE task_watchers.task_id = tasks.id
      AND task_watchers.user_id = auth.uid()
  )
);