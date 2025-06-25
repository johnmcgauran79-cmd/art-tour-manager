
-- First, remove default values that will conflict with the enum change
ALTER TABLE tasks ALTER COLUMN category DROP DEFAULT;
ALTER TABLE task_templates ALTER COLUMN category DROP DEFAULT;
ALTER TABLE capacity_monitoring_rules ALTER COLUMN task_category DROP DEFAULT;

-- Create a new enum for departments
CREATE TYPE public.department AS ENUM ('operations', 'finance', 'marketing', 'booking', 'maintenance', 'general');

-- Create a user_departments table for many-to-many relationship
CREATE TABLE public.user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  department public.department NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, department)
);

-- Enable RLS on user_departments
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_departments
CREATE POLICY "Users can view their own departments" 
  ON public.user_departments 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own departments" 
  ON public.user_departments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own departments" 
  ON public.user_departments 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own departments" 
  ON public.user_departments 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Update the task_category enum to use department instead
ALTER TYPE task_category RENAME TO task_category_old;
CREATE TYPE task_category AS ENUM ('operations', 'finance', 'marketing', 'booking', 'maintenance', 'general');

-- Update tasks table to use new enum
ALTER TABLE tasks ALTER COLUMN category TYPE task_category USING category::text::task_category;

-- Update task_templates table to use new enum
ALTER TABLE task_templates ALTER COLUMN category TYPE task_category USING category::text::task_category;

-- Update capacity_monitoring_rules table to use new enum
ALTER TABLE capacity_monitoring_rules ALTER COLUMN task_category TYPE task_category USING task_category::text::task_category;

-- Restore default values with the new enum
ALTER TABLE tasks ALTER COLUMN category SET DEFAULT 'general'::task_category;
ALTER TABLE task_templates ALTER COLUMN category SET DEFAULT 'general'::task_category;
ALTER TABLE capacity_monitoring_rules ALTER COLUMN task_category SET DEFAULT 'operations'::task_category;

-- Drop old enum
DROP TYPE task_category_old;

-- Create a function to check if user has access to a department
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

-- Update user_notifications to include department field
ALTER TABLE public.user_notifications ADD COLUMN department public.department;

-- Create an index on user_notifications for better performance
CREATE INDEX idx_user_notifications_department ON public.user_notifications(department);
CREATE INDEX idx_user_departments_user_id ON public.user_departments(user_id);
