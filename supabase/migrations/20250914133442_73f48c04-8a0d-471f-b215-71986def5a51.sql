-- Add back admin access but using a direct query to avoid recursion
-- This allows admins to query user_roles without calling has_role()
CREATE POLICY "Direct admin access to user_roles" 
ON public.user_roles 
FOR SELECT 
USING (
  user_id IN (
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin' AND user_id = auth.uid()
  )
);