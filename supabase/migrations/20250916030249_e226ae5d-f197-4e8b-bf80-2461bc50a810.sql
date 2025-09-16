-- Fix RLS policy for tasks to allow admins and department users to update tasks
DROP POLICY "Users can update tasks they created or are assigned to" ON public.tasks;

CREATE POLICY "Users can update tasks they created, are assigned to, or have department access" 
ON public.tasks 
FOR UPDATE 
USING (
  (auth.uid() = created_by) OR 
  (EXISTS (SELECT 1 FROM task_assignments WHERE task_assignments.task_id = tasks.id AND task_assignments.user_id = auth.uid())) OR
  (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')) OR
  (EXISTS (SELECT 1 FROM user_departments WHERE user_departments.user_id = auth.uid() AND user_departments.department::text = tasks.category::text))
);