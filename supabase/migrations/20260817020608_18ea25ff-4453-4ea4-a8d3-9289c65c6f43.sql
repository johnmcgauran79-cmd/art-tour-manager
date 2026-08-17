-- 1. Remove all table-level privileges from unauthenticated visitors.
REVOKE ALL ON public.user_roles FROM anon;

-- 2. Keep the privileges the app actually needs.
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 3. Replace the two overlapping SELECT policies (one of which applied to the
--    PUBLIC role, i.e. anon included) with a single explicit authenticated-only
--    read policy. Staff genuinely need to read other users' role rows for host
--    assignment, task assignee pickers and note/to-do sharing, so the scope of
--    what signed-in staff can see is unchanged.
DROP POLICY IF EXISTS "Allow authenticated users to view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role only" ON public.user_roles;

CREATE POLICY "Signed-in staff can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 4. Scope the admin management policy explicitly to authenticated users.
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));