-- Drop old RLS policies on email_templates
DROP POLICY IF EXISTS "Admins can manage email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can view email templates" ON email_templates;

-- Create helper function to check user role from user_roles table
CREATE OR REPLACE FUNCTION public.check_user_role(user_id uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = check_user_role.user_id
    AND user_roles.role = required_role
  );
END;
$$;

-- Create new RLS policies for email_templates using the new role system
CREATE POLICY "Admins can manage email templates"
ON email_templates
FOR ALL
TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers and booking agents can view email templates"
ON email_templates
FOR SELECT
TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- Grant usage on the function
GRANT EXECUTE ON FUNCTION check_user_role(uuid, text) TO authenticated;