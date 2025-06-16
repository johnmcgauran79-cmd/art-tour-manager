
-- Temporarily allow users to assign themselves admin role if no admins exist yet
-- This solves the bootstrap problem for the first admin

DROP POLICY IF EXISTS "Only admin can create user roles" ON public.user_roles;

CREATE POLICY "Allow admin creation and admin-only management"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (
    -- Allow self-assignment of admin role if no admins exist yet (bootstrap case)
    (auth.uid() = user_id AND role = 'admin' AND NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE role = 'admin'
    ))
    OR
    -- Or if user is already an admin (normal case)
    public.has_role(auth.uid(), 'admin')
  );
