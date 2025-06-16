
-- Remove the bootstrap policy and replace with proper admin-only policy
DROP POLICY IF EXISTS "Allow admin creation and admin-only management" ON public.user_roles;

-- Create strict admin-only policy for role management
CREATE POLICY "Only admin can manage user roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update the other policies to ensure only admins can modify roles
DROP POLICY IF EXISTS "Only admin can update user roles" ON public.user_roles;
CREATE POLICY "Only admin can update user roles"
  ON public.user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admin can delete user roles" ON public.user_roles;
CREATE POLICY "Only admin can delete user roles"
  ON public.user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create or replace the function to automatically assign booking_agent role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    -- Automatically assign booking_agent role to new users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'booking_agent');
    RETURN NEW;
END;
$$;

-- Create trigger to automatically assign role when a profile is created
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_role
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
