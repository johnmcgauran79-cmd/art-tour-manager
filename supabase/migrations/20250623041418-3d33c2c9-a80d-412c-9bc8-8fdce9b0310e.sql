
-- Enable RLS on task_templates table
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all authenticated users to read task templates
-- Since task templates are operational data that should be visible to all users
CREATE POLICY "Allow authenticated users to read task templates" 
ON public.task_templates 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins and managers to create/update/delete task templates
CREATE POLICY "Allow admins to manage task templates" 
ON public.task_templates 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);
