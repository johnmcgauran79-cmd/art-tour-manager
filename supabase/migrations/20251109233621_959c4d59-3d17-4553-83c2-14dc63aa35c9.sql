-- Fix the check_user_role function by replacing it (not dropping)
CREATE OR REPLACE FUNCTION public.check_user_role(user_id uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cast the enum role to text for comparison
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = check_user_role.user_id
    AND user_roles.role::text = required_role
  );
END;
$$;