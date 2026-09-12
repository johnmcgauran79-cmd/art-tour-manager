DROP TABLE IF EXISTS public.crm_migration_contacts;
DROP TABLE IF EXISTS public.crm_migration_runs;
DROP TABLE IF EXISTS public.crm_tag_map;
ALTER TABLE public.tours DROP COLUMN IF EXISTS keap_tag_id;