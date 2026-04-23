-- 1. Enum for entity types
DO $$ BEGIN
  CREATE TYPE public.task_link_entity_type AS ENUM ('booking', 'hotel', 'activity', 'tour', 'contact');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.task_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  entity_type public.task_link_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('description', 'comment')),
  source_id UUID, -- comment id when source='comment'; null for description
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, entity_type, entity_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_task_entity_links_task ON public.task_entity_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_entity_links_entity ON public.task_entity_links(entity_type, entity_id);

ALTER TABLE public.task_entity_links ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view task entity links"
ON public.task_entity_links FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage task entity links"
ON public.task_entity_links FOR ALL
TO authenticated
USING (
  check_user_role(auth.uid(), 'admin')
  OR check_user_role(auth.uid(), 'manager')
  OR check_user_role(auth.uid(), 'booking_agent')
)
WITH CHECK (
  check_user_role(auth.uid(), 'admin')
  OR check_user_role(auth.uid(), 'manager')
  OR check_user_role(auth.uid(), 'booking_agent')
);

-- 3. Helper: extract [[type:uuid|label]] tokens from text
CREATE OR REPLACE FUNCTION public.extract_entity_links(_text TEXT)
RETURNS TABLE(entity_type TEXT, entity_id UUID)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    (m[1])::TEXT AS entity_type,
    (m[2])::UUID AS entity_id
  FROM regexp_matches(
    COALESCE(_text, ''),
    '\[\[(booking|hotel|activity|tour|contact):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\|[^\]]*)?\]\]',
    'gi'
  ) AS m;
END;
$$;

-- 4. Trigger function: sync description links on tasks
CREATE OR REPLACE FUNCTION public.sync_task_description_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove old description links for this task
  DELETE FROM public.task_entity_links
  WHERE task_id = NEW.id AND source = 'description';

  -- Insert new ones
  INSERT INTO public.task_entity_links (task_id, entity_type, entity_id, source, source_id)
  SELECT NEW.id, e.entity_type::public.task_link_entity_type, e.entity_id, 'description', NULL
  FROM public.extract_entity_links(NEW.description) e
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_sync_entity_links ON public.tasks;
CREATE TRIGGER tasks_sync_entity_links
AFTER INSERT OR UPDATE OF description ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_description_links();

-- 5. Trigger function: sync comment links on task_comments
CREATE OR REPLACE FUNCTION public.sync_task_comment_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.task_entity_links
    WHERE task_id = OLD.task_id AND source = 'comment' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Remove old comment links for this comment
  DELETE FROM public.task_entity_links
  WHERE task_id = NEW.task_id AND source = 'comment' AND source_id = NEW.id;

  INSERT INTO public.task_entity_links (task_id, entity_type, entity_id, source, source_id)
  SELECT NEW.task_id, e.entity_type::public.task_link_entity_type, e.entity_id, 'comment', NEW.id
  FROM public.extract_entity_links(NEW.comment) e
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_sync_entity_links ON public.task_comments;
CREATE TRIGGER task_comments_sync_entity_links
AFTER INSERT OR UPDATE OF comment OR DELETE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_comment_links();