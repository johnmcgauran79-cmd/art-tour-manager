
-- Create the app_role ENUM type only if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'booking_agent');
    END IF;
END
$$;

-- Create the user_roles table if it does not exist
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Utility function for checking a user's role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies as previously discussed
CREATE POLICY "Only admin can create user roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admin can update user roles"
  ON public.user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User can view their own role"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
