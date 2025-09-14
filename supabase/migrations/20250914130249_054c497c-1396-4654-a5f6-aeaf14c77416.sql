-- Fix the REAL infinite recursion issue
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view their own role, admins view all" ON public.user_roles;

-- Create a simple policy that ONLY checks user_id match
-- No admin checks to avoid recursion
CREATE POLICY "Users can view their own role only" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Separate admin policy using the security definer function
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));