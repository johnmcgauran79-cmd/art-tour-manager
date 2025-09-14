-- DEFINITIVE FIX: Remove the infinite recursion completely
-- The admin policy is causing recursion by calling has_role() which queries user_roles

-- Drop the problematic admin policy that uses has_role()
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Only keep the simple user-only policy - no admin override needed
-- Admins can use the admin interface or direct database access if needed
-- This completely eliminates the recursion issue

-- The user policy remains:
-- "Users can view their own role only" already exists and works fine