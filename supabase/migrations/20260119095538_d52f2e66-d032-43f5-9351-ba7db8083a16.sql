ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS preferred_name text DEFAULT NULL;