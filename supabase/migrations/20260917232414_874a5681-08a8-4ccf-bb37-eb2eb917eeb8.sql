ALTER TYPE public.task_link_entity_type ADD VALUE IF NOT EXISTS 'campaign';

ALTER TABLE public.task_entity_links DROP CONSTRAINT IF EXISTS task_entity_links_source_check;
ALTER TABLE public.task_entity_links
  ADD CONSTRAINT task_entity_links_source_check
  CHECK (source = ANY (ARRAY['description'::text, 'comment'::text, 'manual'::text]));

CREATE OR REPLACE FUNCTION public.extract_entity_links(_text text)
RETURNS TABLE(entity_type text, entity_id uuid)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    (m[1])::TEXT AS entity_type,
    (m[2])::UUID AS entity_id
  FROM regexp_matches(
    COALESCE(_text, ''),
    '\[\[(booking|hotel|activity|tour|contact|lead|campaign):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\|[^\]]*)?\]\]',
    'gi'
  ) AS m;
END;
$function$;