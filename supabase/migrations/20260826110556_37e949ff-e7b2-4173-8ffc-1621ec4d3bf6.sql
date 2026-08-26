ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS managed_by_dmc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dmc_name text,
  ADD COLUMN IF NOT EXISTS dmc_contact_name text,
  ADD COLUMN IF NOT EXISTS dmc_contact_email text,
  ADD COLUMN IF NOT EXISTS dmc_contact_phone text;