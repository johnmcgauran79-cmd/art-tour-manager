ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS brevo_list_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS tags_brevo_list_id_key ON public.tags(brevo_list_id) WHERE brevo_list_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_brevo_contact_id_idx ON public.customers(brevo_contact_id) WHERE brevo_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_email_lower_idx ON public.customers(lower(email));