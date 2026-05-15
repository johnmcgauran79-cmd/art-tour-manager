
-- Create per-template assignees table
CREATE TABLE IF NOT EXISTS public.task_template_assignees (
  template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, user_id)
);

ALTER TABLE public.task_template_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view template assignees"
  ON public.task_template_assignees FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can manage template assignees"
  ON public.task_template_assignees FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Update task generation to assign explicit users from template_assignees,
-- creating one task per assignee. Department-based routing is removed.
CREATE OR REPLACE FUNCTION public.generate_tour_operation_tasks(p_tour_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tour RECORD;
  v_template RECORD;
  v_assignee RECORD;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_reference_date DATE;
  v_system_user_id UUID;
  v_task_id UUID;
  v_rule TEXT;
BEGIN
  SELECT t.*,
         h.initial_rooms_cutoff_date,
         h.final_rooms_cutoff_date
  INTO v_tour
  FROM tours t
  LEFT JOIN hotels h ON h.tour_id = t.id
  WHERE t.id = p_tour_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tour not found: %', p_tour_id;
  END IF;

  SELECT ur.user_id INTO v_system_user_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found to assign automated tasks';
  END IF;

  FOR v_template IN
    SELECT * FROM task_templates
    WHERE is_active = true AND days_before_tour IS NOT NULL
    ORDER BY days_before_tour DESC
  LOOP
    CASE v_template.date_field_type
      WHEN 'tour_start_date' THEN v_reference_date := v_tour.start_date;
      WHEN 'tour_end_date' THEN v_reference_date := v_tour.end_date;
      WHEN 'initial_rooms_cutoff_date' THEN v_reference_date := v_tour.initial_rooms_cutoff_date;
      WHEN 'final_rooms_cutoff_date' THEN v_reference_date := v_tour.final_rooms_cutoff_date;
      WHEN 'instalment_date' THEN v_reference_date := v_tour.instalment_date;
      WHEN 'final_payment_date' THEN v_reference_date := v_tour.final_payment_date;
      ELSE v_reference_date := v_tour.start_date;
    END CASE;

    IF v_reference_date IS NOT NULL THEN
      v_due_date := (v_reference_date - INTERVAL '1 day' * v_template.days_before_tour)::timestamp with time zone;

      -- One task per explicit assignee
      FOR v_assignee IN
        SELECT user_id FROM task_template_assignees WHERE template_id = v_template.id
      LOOP
        v_rule := 'tour_operations_' || v_template.id::text || '_' || v_assignee.user_id::text;

        IF NOT EXISTS (
          SELECT 1 FROM tasks
          WHERE tour_id = p_tour_id
          AND automated_rule = v_rule
          AND status NOT IN ('completed', 'cancelled', 'archived')
        ) THEN
          INSERT INTO tasks (
            title, description, status, priority, category, due_date,
            tour_id, created_by, is_automated, automated_rule
          ) VALUES (
            v_template.name,
            v_template.description || ' for ' || v_tour.name || ' (due ' || v_template.days_before_tour || ' days before ' || v_template.date_field_type || ')',
            'not_started',
            v_template.priority,
            v_template.category,
            v_due_date,
            p_tour_id,
            v_system_user_id,
            true,
            v_rule
          ) RETURNING id INTO v_task_id;

          INSERT INTO task_assignments (task_id, user_id, assigned_by)
          VALUES (v_task_id, v_assignee.user_id, v_system_user_id);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;
