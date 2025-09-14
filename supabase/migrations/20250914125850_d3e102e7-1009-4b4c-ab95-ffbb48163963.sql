-- Fix infinite recursion in user_roles RLS policy
-- Drop the existing problematic policy
DROP POLICY IF EXISTS "User can view their own role" ON public.user_roles;

-- Create a simple policy that doesn't use has_role function
CREATE POLICY "Users can view their own role, admins view all" 
ON public.user_roles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.user_roles ur2 
    WHERE ur2.user_id = auth.uid() 
    AND ur2.role = 'admin'
  )
);