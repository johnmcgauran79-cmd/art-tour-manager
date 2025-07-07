
-- Update RLS policies for user_departments to allow admins to manage all departments
DROP POLICY IF EXISTS "Users can insert their own departments" ON public.user_departments;
DROP POLICY IF EXISTS "Users can update their own departments" ON public.user_departments;
DROP POLICY IF EXISTS "Users can delete their own departments" ON public.user_departments;
DROP POLICY IF EXISTS "Users can view their own departments" ON public.user_departments;

-- Create new policies that allow both users to manage their own and admins to manage all
CREATE POLICY "Users can insert departments" ON public.user_departments
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can update departments" ON public.user_departments
  FOR UPDATE 
  USING (
    auth.uid() = user_id OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can delete departments" ON public.user_departments
  FOR DELETE 
  USING (
    auth.uid() = user_id OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can view departments" ON public.user_departments
  FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    has_role(auth.uid(), 'admin'::app_role)
  );
