-- First drop the trigger and function that depend on cutoff_date
DROP TRIGGER IF EXISTS activity_date_change_trigger ON activities;
DROP FUNCTION IF EXISTS public.handle_activity_date_change();

-- Remove cutoff_date column from activities table
ALTER TABLE public.activities DROP COLUMN IF EXISTS cutoff_date;

-- Update the constraint for date_field_type to remove activity_cutoff_date
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
  'final_payment_date'
));

-- Update the generate_tour_operation_tasks function to remove activity_cutoff_date handling
CREATE OR REPLACE FUNCTION public.generate_tour_operation_tasks(p_tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tour RECORD;
  v_template RECORD;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_reference_date DATE;
  v_system_user_id UUID;
  v_task_id UUID;
  v_department_name department;
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
      ELSE
        v_reference_date := v_tour.start_date; -- Default fallback
    END CASE;
    
    -- Only proceed if we have a reference date
    IF v_reference_date IS NOT NULL THEN
      -- Calculate due date (ensure it's timezone aware)
      v_due_date := (v_reference_date - INTERVAL '1 day' * v_template.days_before_tour)::timestamp with time zone;
      
      -- Create task regardless of due date (so past tours can still have their tasks visible)
      -- Check if task already exists with same title for this tour
      IF NOT EXISTS (
        SELECT 1 FROM tasks 
        WHERE tour_id = p_tour_id 
        AND title = v_template.name
        AND status NOT IN ('completed', 'cancelled', 'archived')
      ) THEN
        -- Create the task and get the ID
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
        ) RETURNING id INTO v_task_id;
        
        -- Map task category to department
        CASE v_template.category
          WHEN 'booking' THEN
            v_department_name := 'booking'::department;
          WHEN 'operations' THEN
            v_department_name := 'operations'::department;
          WHEN 'finance' THEN
            v_department_name := 'finance'::department;
          WHEN 'marketing' THEN
            v_department_name := 'marketing'::department;
          WHEN 'maintenance' THEN
            v_department_name := 'maintenance'::department;
          ELSE
            v_department_name := 'general'::department; -- Default to general
        END CASE;
        
        -- Auto-assign ONLY to users in the relevant department
        -- No fallback to admins/managers if no users in department
        INSERT INTO task_assignments (task_id, user_id, assigned_by)
        SELECT v_task_id, ud.user_id, v_system_user_id
        FROM user_departments ud
        WHERE ud.department = v_department_name;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Update the handle_tour_date_change function to remove activity_cutoff_date reference
CREATE OR REPLACE FUNCTION public.handle_tour_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_reference_date DATE;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_hotel RECORD;
BEGIN
  -- Check if any relevant dates changed
  IF OLD.start_date IS DISTINCT FROM NEW.start_date OR 
     OLD.end_date IS DISTINCT FROM NEW.end_date OR 
     OLD.instalment_date IS DISTINCT FROM NEW.instalment_date OR 
     OLD.final_payment_date IS DISTINCT FROM NEW.final_payment_date THEN
    
    -- Get hotel dates for this tour if they exist
    SELECT initial_rooms_cutoff_date, final_rooms_cutoff_date
    INTO v_hotel
    FROM hotels 
    WHERE tour_id = NEW.id
    LIMIT 1;
    
    -- Update due dates for existing automated tasks (DO NOT CREATE NEW ONES)
    FOR v_template IN 
      SELECT tt.*, t.id as task_id
      FROM task_templates tt
      JOIN tasks t ON t.automated_rule = 'tour_operations_' || tt.id::text
      WHERE t.tour_id = NEW.id 
      AND t.is_automated = true
      AND t.status NOT IN ('completed', 'cancelled', 'archived')
      AND tt.is_active = true
    LOOP
      -- Determine the reference date based on date_field_type
      CASE v_template.date_field_type
        WHEN 'tour_start_date' THEN
          v_reference_date := NEW.start_date;
        WHEN 'tour_end_date' THEN
          v_reference_date := NEW.end_date;
        WHEN 'initial_rooms_cutoff_date' THEN
          v_reference_date := v_hotel.initial_rooms_cutoff_date;
        WHEN 'final_rooms_cutoff_date' THEN
          v_reference_date := v_hotel.final_rooms_cutoff_date;
        WHEN 'instalment_date' THEN
          v_reference_date := NEW.instalment_date;
        WHEN 'final_payment_date' THEN
          v_reference_date := NEW.final_payment_date;
        ELSE
          v_reference_date := NEW.start_date; -- Default fallback
      END CASE;
      
      -- Only update if we have a reference date
      IF v_reference_date IS NOT NULL THEN
        -- Calculate new due date
        v_due_date := (v_reference_date - INTERVAL '1 day' * v_template.days_before_tour)::timestamp with time zone;
        
        -- Update the task's due date (DO NOT CREATE NEW TASKS)
        UPDATE tasks 
        SET due_date = v_due_date,
            updated_at = now()
        WHERE id = v_template.task_id;
      END IF;
    END LOOP;
    
    -- Log the date update
    INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
    VALUES (
      COALESCE(auth.uid(), (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)),
      'UPDATE_TASK_DATES',
      'tours',
      NEW.id,
      jsonb_build_object(
        'old_start_date', OLD.start_date,
        'new_start_date', NEW.start_date,
        'old_end_date', OLD.end_date,
        'new_end_date', NEW.end_date,
        'trigger_source', 'tour_date_change'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;