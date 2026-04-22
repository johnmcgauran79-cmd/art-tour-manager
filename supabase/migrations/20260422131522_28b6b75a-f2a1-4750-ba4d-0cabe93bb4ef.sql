ALTER TABLE public.task_comments
ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_comments_task_parent_created
ON public.task_comments (task_id, parent_comment_id, created_at);

CREATE OR REPLACE FUNCTION public.validate_task_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_task_id uuid;
  parent_parent_id uuid;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT task_id, parent_comment_id
  INTO parent_task_id, parent_parent_id
  FROM public.task_comments
  WHERE id = NEW.parent_comment_id;

  IF parent_task_id IS NULL THEN
    RAISE EXCEPTION 'Parent comment not found';
  END IF;

  IF parent_task_id <> NEW.task_id THEN
    RAISE EXCEPTION 'Reply must belong to the same task as its parent comment';
  END IF;

  IF parent_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only one reply level is allowed for task comments';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_task_comment_parent_trigger ON public.task_comments;
CREATE TRIGGER validate_task_comment_parent_trigger
BEFORE INSERT OR UPDATE OF parent_comment_id, task_id ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_comment_parent();