
-- Fix infinite recursion in RLS policies by dropping existing problematic policies
-- and creating new ones that don't cause circular references

-- Drop existing policies that may be causing recursion
DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assigned users can update tasks" ON public.tasks;

DROP POLICY IF EXISTS "Users can view task assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Users can create task assignments" ON public.task_assignments;

-- Create new, non-recursive policies for tasks
CREATE POLICY "Authenticated users can create tasks" ON public.tasks
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view tasks they created or are assigned to" ON public.tasks
FOR SELECT USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM public.task_assignments 
    WHERE task_id = tasks.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tasks they created or are assigned to" ON public.tasks
FOR UPDATE USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM public.task_assignments 
    WHERE task_id = tasks.id AND user_id = auth.uid()
  )
);

-- Create new, non-recursive policies for task assignments
CREATE POLICY "Authenticated users can view task assignments" ON public.task_assignments
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Task creators and assigners can create assignments" ON public.task_assignments
FOR INSERT WITH CHECK (
  auth.uid() = assigned_by OR
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE id = task_assignments.task_id AND created_by = auth.uid()
  )
);
