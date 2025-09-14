-- Remove the recursive policy I just created
DROP POLICY IF EXISTS "Direct admin access to user_roles" ON public.user_roles;

-- Create a simple policy that allows all authenticated users to see all user roles
-- This is temporary to diagnose the issue
CREATE POLICY "Allow authenticated users to view user roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);