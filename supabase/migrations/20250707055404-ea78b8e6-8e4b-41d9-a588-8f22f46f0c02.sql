
-- Add department field to user_notifications for department-specific filtering
ALTER TABLE public.user_notifications ADD COLUMN IF NOT EXISTS department public.department;

-- Create an index on user_notifications for better performance when filtering by department
CREATE INDEX IF NOT EXISTS idx_user_notifications_department ON public.user_notifications(department);

-- Create an index on user_departments for better performance
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON public.user_departments(user_id);

-- Update the user_has_department function to ensure it works correctly
CREATE OR REPLACE FUNCTION public.user_has_department(_user_id uuid, _department department)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_departments 
    WHERE user_id = _user_id AND department = _department
  )
$$;
