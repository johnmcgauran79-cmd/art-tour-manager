CREATE OR REPLACE FUNCTION public.log_task_activity(
  p_task_id uuid,
  p_event_type text,
  p_old jsonb,
  p_new jsonb,
  p_message text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Tour deletion and other system cleanup can remove task child rows as part of
  -- a parent task/tour delete. In that context, child DELETE triggers must not
  -- recreate task activity rows for tasks that are already being removed.
  IF current_setting('app.suppress_task_activity_log', true) = 'true' THEN
    RETURN;
  END IF;

  -- Defensive guard for cascades: if the parent task is gone or is being deleted
  -- in the current statement, do not insert an activity row that would violate
  -- task_activity_log_task_id_fkey.
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = p_task_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.task_activity_log (task_id, actor_id, event_type, old_value, new_value, message)
  VALUES (p_task_id, auth.uid(), p_event_type, p_old, p_new, p_message);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_tour_with_cascade(p_tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tour_exists boolean;
  v_task_count integer := 0;
BEGIN
  -- Only admins may delete tours. Managers and agents are intentionally blocked.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can delete tours';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.tours WHERE id = p_tour_id)
  INTO v_tour_exists;

  IF NOT v_tour_exists THEN
    RAISE EXCEPTION 'Tour not found';
  END IF;

  SELECT COUNT(*)
  INTO v_task_count
  FROM public.tasks
  WHERE tour_id = p_tour_id;

  -- Suppress task activity audit triggers while performing destructive system cleanup.
  -- The tour deletion itself is still recorded in audit_log below.
  PERFORM set_config('app.suppress_task_activity_log', 'true', true);

  -- automated_email_log.tour_id is NO ACTION, so it must be cleared manually before deleting the tour.
  DELETE FROM public.automated_email_log
  WHERE tour_id = p_tour_id;

  -- Clean task child data explicitly before deleting the tour. These tables already
  -- have CASCADE FKs, but their DELETE triggers write task_activity_log rows; doing
  -- this under the suppress flag prevents FK failures during parent task deletion.
  DELETE FROM public.task_comment_attachments
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_entity_links
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_subtasks
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_watchers
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_approvers
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_assignments
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_attachments
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_comments
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.task_activity_log
  WHERE task_id IN (SELECT id FROM public.tasks WHERE tour_id = p_tour_id);

  DELETE FROM public.tasks
  WHERE tour_id = p_tour_id;

  -- Remaining tour-linked records are covered by existing FK behaviour:
  -- bookings/activities/hotels/forms/itineraries/alerts/attachments/hosts/etc. cascade,
  -- while email/report logs with SET NULL keep historical records without blocking deletion.
  DELETE FROM public.tours
  WHERE id = p_tour_id;

  INSERT INTO public.audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'DELETE_TOUR_CASCADE',
    'tours',
    p_tour_id,
    jsonb_build_object(
      'cascade', true,
      'task_count', v_task_count,
      'task_activity_suppressed', true
    )
  );
END;
$function$;