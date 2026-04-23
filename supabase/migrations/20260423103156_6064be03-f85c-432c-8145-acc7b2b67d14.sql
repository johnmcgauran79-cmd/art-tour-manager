
-- Add edit tracking to task_comments
ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by uuid;

-- Trigger function: stamp edit metadata and log activity when comment text changes
CREATE OR REPLACE FUNCTION public.task_comments_handle_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.comment IS DISTINCT FROM OLD.comment THEN
    NEW.edited_at := now();
    NEW.edited_by := auth.uid();
    NEW.updated_at := now();

    PERFORM public.log_task_activity(
      NEW.task_id,
      'comment_edited',
      jsonb_build_object('comment_id', NEW.id, 'comment', LEFT(OLD.comment, 280)),
      jsonb_build_object('comment_id', NEW.id, 'comment', LEFT(NEW.comment, 280)),
      LEFT(NEW.comment, 280)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS task_comments_edit_trigger ON public.task_comments;
CREATE TRIGGER task_comments_edit_trigger
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.task_comments_handle_edit();

-- Allow comment authors to update their own comments
DROP POLICY IF EXISTS "Users can update their own task comments" ON public.task_comments;
CREATE POLICY "Users can update their own task comments"
  ON public.task_comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
