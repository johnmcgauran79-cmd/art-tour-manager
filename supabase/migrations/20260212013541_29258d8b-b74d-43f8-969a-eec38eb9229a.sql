
DROP POLICY "Users can view own profile, admins view all" ON public.profiles;

CREATE POLICY "Users can view own profile, admins and managers view all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);
