
-- Add missing DELETE policy for tasks table
CREATE POLICY "Users can delete tasks they created or are assigned to" 
ON public.tasks 
FOR DELETE 
USING (
  (auth.uid() = created_by) OR 
  (EXISTS (
    SELECT 1 
    FROM task_assignments 
    WHERE task_assignments.task_id = tasks.id 
    AND task_assignments.user_id = auth.uid()
  ))
);
