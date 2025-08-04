-- Update the tasks SELECT policy to include department-based visibility
DROP POLICY "Users can view tasks they created or are assigned to" ON tasks;

CREATE POLICY "Users can view tasks they created, are assigned to, or match their department" 
ON tasks 
FOR SELECT 
USING (
  -- User created the task
  (auth.uid() = created_by) 
  OR 
  -- User is directly assigned to the task
  (EXISTS (
    SELECT 1 
    FROM task_assignments 
    WHERE task_assignments.task_id = tasks.id 
    AND task_assignments.user_id = auth.uid()
  ))
  OR
  -- User is in a department that matches the task category
  (EXISTS (
    SELECT 1 
    FROM user_departments 
    WHERE user_departments.user_id = auth.uid() 
    AND user_departments.department::text = tasks.category::text
  ))
);