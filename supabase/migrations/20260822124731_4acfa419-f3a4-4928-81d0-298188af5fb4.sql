-- 1. Contacts: Brevo identity + provenance
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS brevo_contact_id text,
  ADD COLUMN IF NOT EXISTS brevo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_source text;

CREATE INDEX IF NOT EXISTS idx_customers_brevo_contact_id ON public.customers (brevo_contact_id);

-- 2. Migration runs
CREATE TABLE public.crm_migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL DEFAULT 'pull',
  status text NOT NULL DEFAULT 'idle',
  keap_cursor integer NOT NULL DEFAULT 0,
  push_cursor integer NOT NULL DEFAULT 0,
  total_pulled integer NOT NULL DEFAULT 0,
  total_pushed integer NOT NULL DEFAULT 0,
  total_skipped integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  notes_pulled integer NOT NULL DEFAULT 0,
  tags_pulled integer NOT NULL DEFAULT 0,
  last_error text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_migration_runs TO authenticated;
GRANT ALL ON public.crm_migration_runs TO service_role;
ALTER TABLE public.crm_migration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage crm migration runs"
ON public.crm_migration_runs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_crm_migration_runs_updated_at
BEFORE UPDATE ON public.crm_migration_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Staged contacts
CREATE TABLE public.crm_migration_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.crm_migration_runs(id) ON DELETE CASCADE,
  keap_contact_id text NOT NULL,
  email text,
  first_name text,
  last_name text,
  phone text,
  company text,
  address_line1 text,
  city text,
  state text,
  postcode text,
  country text,
  keap_created_at timestamptz,
  opt_in_status text,
  is_blocklisted boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes_text text,
  notes_count integer NOT NULL DEFAULT 0,
  raw jsonb,
  brevo_payload jsonb,
  matched_customer_id uuid,
  brevo_contact_id text,
  status text NOT NULL DEFAULT 'staged',
  skip_reason text,
  error_message text,
  duplicate_of uuid,
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, keap_contact_id)
);

CREATE INDEX idx_crm_migration_contacts_run_status ON public.crm_migration_contacts (run_id, status);
CREATE INDEX idx_crm_migration_contacts_email ON public.crm_migration_contacts (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_migration_contacts TO authenticated;
GRANT ALL ON public.crm_migration_contacts TO service_role;
ALTER TABLE public.crm_migration_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage crm staged contacts"
ON public.crm_migration_contacts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_crm_migration_contacts_updated_at
BEFORE UPDATE ON public.crm_migration_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tag mapping decisions
CREATE TABLE public.crm_tag_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keap_tag_id text NOT NULL UNIQUE,
  keap_tag_name text NOT NULL,
  keap_tag_category text,
  contact_count integer NOT NULL DEFAULT 0,
  target_type text NOT NULL DEFAULT 'skip',
  target_name text,
  brevo_list_id integer,
  brevo_attribute text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tag_map TO authenticated;
GRANT ALL ON public.crm_tag_map TO service_role;
ALTER TABLE public.crm_tag_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage crm tag map"
ON public.crm_tag_map FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_crm_tag_map_updated_at
BEFORE UPDATE ON public.crm_tag_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();