-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;

-- Create a new policy that allows both admins and managers to manage email templates
CREATE POLICY "Admins and managers can manage email templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager')
)
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager')
);