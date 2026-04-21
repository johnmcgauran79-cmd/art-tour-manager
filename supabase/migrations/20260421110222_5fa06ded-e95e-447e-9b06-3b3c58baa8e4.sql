
-- 1. Add columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS quick_update text,
  ADD COLUMN IF NOT EXISTS quick_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS quick_update_by uuid,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tasks_last_activity_at ON public.tasks(last_activity_at DESC);

-- 2. Activity log
CREATE TABLE IF NOT EXISTS public.task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON public.task_activity_log(task_id, created_at DESC);

ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view task activity"
  ON public.task_activity_log FOR SELECT TO authenticated
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent') OR check_user_role(auth.uid(), 'agent'));

CREATE POLICY "Hosts can view task activity for assigned tours"
  ON public.task_activity_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_activity_log.task_id AND t.tour_id IS NOT NULL AND is_host_for_tour(auth.uid(), t.tour_id)));

CREATE POLICY "System can insert task activity"
  ON public.task_activity_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Watchers
CREATE TABLE IF NOT EXISTS public.task_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_watchers_task ON public.task_watchers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_user ON public.task_watchers(user_id);

ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view watchers"
  ON public.task_watchers FOR SELECT TO authenticated
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent') OR check_user_role(auth.uid(), 'agent'));

CREATE POLICY "Hosts can view watchers for assigned tours"
  ON public.task_watchers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_watchers.task_id AND t.tour_id IS NOT NULL AND is_host_for_tour(auth.uid(), t.tour_id)));

CREATE POLICY "Staff can manage watchers"
  ON public.task_watchers FOR INSERT TO authenticated
  WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Staff can delete watchers"
  ON public.task_watchers FOR DELETE TO authenticated
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent') OR auth.uid() = user_id);

-- 4. Subtasks
CREATE TABLE IF NOT EXISTS public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON public.task_subtasks(task_id, sort_order);

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view subtasks"
  ON public.task_subtasks FOR SELECT TO authenticated
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent') OR check_user_role(auth.uid(), 'agent'));

CREATE POLICY "Hosts can view subtasks for assigned tours"
  ON public.task_subtasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_subtasks.task_id AND t.tour_id IS NOT NULL AND is_host_for_tour(auth.uid(), t.tour_id)));

CREATE POLICY "Staff can manage subtasks"
  ON public.task_subtasks FOR ALL TO authenticated
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'))
  WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'));

CREATE TRIGGER trg_task_subtasks_updated_at
  BEFORE UPDATE ON public.task_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Comment attachments
CREATE TABLE IF NOT EXISTS public.task_comment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  file_type text,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comment_attachments_comment ON public.task_comment_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_attachments_task ON public.task_comment_attachments(task_id);

ALTER TABLE public.task_comment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view comment attachments"
  ON public.task_comment_attachments FOR SELECT TO authenticated
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent') OR check_user_role(auth.uid(), 'agent'));

CREATE POLICY "Hosts can view comment attachments for assigned tours"
  ON public.task_comment_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comment_attachments.task_id AND t.tour_id IS NOT NULL AND is_host_for_tour(auth.uid(), t.tour_id)));

CREATE POLICY "Staff can insert comment attachments"
  ON public.task_comment_attachments FOR INSERT TO authenticated
  WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Staff can delete comment attachments"
  ON public.task_comment_attachments FOR DELETE TO authenticated
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent') OR auth.uid() = uploaded_by);

-- 6. Activity log triggers

-- Helper: log a task activity row & bump last_activity_at
CREATE OR REPLACE FUNCTION public.log_task_activity(
  p_task_id uuid,
  p_event_type text,
  p_old jsonb,
  p_new jsonb,
  p_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_activity_log (task_id, actor_id, event_type, old_value, new_value, message)
  VALUES (p_task_id, auth.uid(), p_event_type, p_old, p_new, p_message);

  UPDATE public.tasks SET last_activity_at = now() WHERE id = p_task_id;
END;
$$;

-- Trigger on tasks update: detect status / due_date / priority / assignee-relevant fields / quick_update
CREATE OR REPLACE FUNCTION public.tasks_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_task_activity(NEW.id, 'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status), NULL);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM public.log_task_activity(NEW.id, 'priority_changed',
      jsonb_build_object('priority', OLD.priority),
      jsonb_build_object('priority', NEW.priority), NULL);
  END IF;

  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    PERFORM public.log_task_activity(NEW.id, 'due_date_changed',
      jsonb_build_object('due_date', OLD.due_date),
      jsonb_build_object('due_date', NEW.due_date), NULL);
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    PERFORM public.log_task_activity(NEW.id, 'title_changed',
      jsonb_build_object('title', OLD.title),
      jsonb_build_object('title', NEW.title), NULL);
  END IF;

  IF NEW.quick_update IS DISTINCT FROM OLD.quick_update THEN
    PERFORM public.log_task_activity(NEW.id, 'quick_update_changed',
      jsonb_build_object('quick_update', OLD.quick_update),
      jsonb_build_object('quick_update', NEW.quick_update), NEW.quick_update);
    -- Stamp author / time
    NEW.quick_update_at := now();
    NEW.quick_update_by := auth.uid();
  END IF;

  -- Always bump last_activity_at on any meaningful update
  NEW.last_activity_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_log_changes ON public.tasks;
CREATE TRIGGER trg_tasks_log_changes
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_log_changes();

-- Trigger on task_assignments insert/delete
CREATE OR REPLACE FUNCTION public.task_assignments_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_task_activity(NEW.task_id, 'assignee_added',
      NULL, jsonb_build_object('user_id', NEW.user_id), NULL);
    -- Auto-add as watcher
    INSERT INTO public.task_watchers (task_id, user_id, added_by)
    VALUES (NEW.task_id, NEW.user_id, NEW.assigned_by)
    ON CONFLICT (task_id, user_id) DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_task_activity(OLD.task_id, 'assignee_removed',
      jsonb_build_object('user_id', OLD.user_id), NULL, NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assignments_log ON public.task_assignments;
CREATE TRIGGER trg_task_assignments_log
  AFTER INSERT OR DELETE ON public.task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.task_assignments_log();

-- Trigger on task_comments insert
CREATE OR REPLACE FUNCTION public.task_comments_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_task_activity(NEW.task_id, 'comment_added',
    NULL, jsonb_build_object('comment_id', NEW.id),
    LEFT(NEW.comment, 280));
  -- Auto-watch
  INSERT INTO public.task_watchers (task_id, user_id, added_by)
  VALUES (NEW.task_id, NEW.user_id, NEW.user_id)
  ON CONFLICT (task_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_comments_log ON public.task_comments;
CREATE TRIGGER trg_task_comments_log
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.task_comments_log();

-- Trigger on task_attachments insert/delete
CREATE OR REPLACE FUNCTION public.task_attachments_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_task_activity(NEW.task_id, 'attachment_added',
      NULL, jsonb_build_object('file_name', NEW.file_name, 'attachment_id', NEW.id), NEW.file_name);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_task_activity(OLD.task_id, 'attachment_removed',
      jsonb_build_object('file_name', OLD.file_name), NULL, OLD.file_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_attachments_log ON public.task_attachments;
CREATE TRIGGER trg_task_attachments_log
  AFTER INSERT OR DELETE ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.task_attachments_log();

-- Trigger on subtasks insert/update
CREATE OR REPLACE FUNCTION public.task_subtasks_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_task_activity(NEW.task_id, 'subtask_added',
      NULL, jsonb_build_object('subtask_id', NEW.id, 'title', NEW.title), NEW.title);
  ELSIF TG_OP = 'UPDATE' AND NEW.completed IS DISTINCT FROM OLD.completed THEN
    PERFORM public.log_task_activity(NEW.task_id,
      CASE WHEN NEW.completed THEN 'subtask_completed' ELSE 'subtask_reopened' END,
      jsonb_build_object('completed', OLD.completed),
      jsonb_build_object('completed', NEW.completed, 'title', NEW.title), NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_subtasks_log ON public.task_subtasks;
CREATE TRIGGER trg_task_subtasks_log
  AFTER INSERT OR UPDATE ON public.task_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.task_subtasks_log();
