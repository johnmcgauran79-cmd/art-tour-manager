
-- Add cutoff_date field to activities table
ALTER TABLE public.activities 
ADD COLUMN cutoff_date date;

-- Update the generate_tour_operation_tasks function to include cutoff_date as an option
CREATE OR REPLACE FUNCTION public.generate_tour_operation_tasks(p_tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tour RECORD;
  v_template RECORD;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_reference_date DATE;
  v_system_user_id UUID;
  v_activity RECORD;
BEGIN
  -- Get tour details including hotel dates
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
  
  -- Get a system user (first admin user)
  SELECT ur.user_id INTO v_system_user_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;
  
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found to assign automated tasks';
  END IF;
  
  -- Generate tasks for each active template
  FOR v_template IN 
    SELECT * FROM task_templates 
    WHERE is_active = true AND days_before_tour IS NOT NULL
    ORDER BY days_before_tour DESC
  LOOP
    -- Determine the reference date based on date_field_type
    CASE v_template.date_field_type
      WHEN 'tour_start_date' THEN
        v_reference_date := v_tour.start_date;
      WHEN 'tour_end_date' THEN
        v_reference_date := v_tour.end_date;
      WHEN 'initial_rooms_cutoff_date' THEN
        v_reference_date := v_tour.initial_rooms_cutoff_date;
      WHEN 'final_rooms_cutoff_date' THEN
        v_reference_date := v_tour.final_rooms_cutoff_date;
      WHEN 'instalment_date' THEN
        v_reference_date := v_tour.instalment_date;
      WHEN 'final_payment_date' THEN
        v_reference_date := v_tour.final_payment_date;
      WHEN 'activity_cutoff_date' THEN
        -- For activity cutoff dates, we need to get the earliest cutoff date from activities
        SELECT MIN(cutoff_date) INTO v_reference_date
        FROM activities 
        WHERE tour_id = p_tour_id AND cutoff_date IS NOT NULL;
      ELSE
        v_reference_date := v_tour.start_date; -- Default fallback
    END CASE;
    
    -- Only proceed if we have a reference date
    IF v_reference_date IS NOT NULL THEN
      -- Calculate due date
      v_due_date := v_reference_date - INTERVAL '1 day' * v_template.days_before_tour;
      
      -- Only create task if due date is in the future
      IF v_due_date > now() THEN
        -- Check if task already exists
        IF NOT EXISTS (
          SELECT 1 FROM tasks 
          WHERE tour_id = p_tour_id 
          AND title = v_template.name
          AND status NOT IN ('completed', 'cancelled')
        ) THEN
          -- Create the task
          INSERT INTO tasks (
            title,
            description,
            status,
            priority,
            category,
            due_date,
            tour_id,
            created_by,
            is_automated,
            automated_rule
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
            'tour_operations_' || v_template.id::text
          );
          
          -- Auto-assign to managers/admins
          INSERT INTO task_assignments (task_id, user_id, assigned_by)
          SELECT currval('tasks_id_seq'), ur.user_id, v_system_user_id
          FROM user_roles ur
          WHERE ur.role IN ('admin', 'manager');
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Update the constraint for date_field_type to include activity_cutoff_date
ALTER TABLE public.task_templates 
DROP CONSTRAINT IF EXISTS valid_date_field_type;

ALTER TABLE public.task_templates 
ADD CONSTRAINT valid_date_field_type 
CHECK (date_field_type IN (
  'tour_start_date',
  'tour_end_date', 
  'initial_rooms_cutoff_date',
  'final_rooms_cutoff_date',
  'instalment_date',
  'final_payment_date',
  'activity_cutoff_date'
));
