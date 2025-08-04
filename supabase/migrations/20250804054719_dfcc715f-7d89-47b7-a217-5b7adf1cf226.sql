-- Fix search_path for functions that don't have it set
-- These functions need search_path set to prevent security issues

-- Update update_booking_on_comment function
CREATE OR REPLACE FUNCTION public.update_booking_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE bookings 
    SET updated_at = now() 
    WHERE id = NEW.booking_id;
    RETURN NEW;
END;
$function$;

-- Update generate_tour_operation_tasks function (already has search_path but let's make sure it's correct)
CREATE OR REPLACE FUNCTION public.generate_tour_operation_tasks(p_tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        
        -- Auto-assign to users in the relevant department
        INSERT INTO task_assignments (task_id, user_id, assigned_by)
        SELECT v_task_id, ud.user_id, v_system_user_id
        FROM user_departments ud
        WHERE ud.department = v_department_name;
        
        -- If no users in department, fallback to assigning to admins/managers
        IF NOT EXISTS (SELECT 1 FROM task_assignments WHERE task_id = v_task_id) THEN
          INSERT INTO task_assignments (task_id, user_id, assigned_by)
          SELECT v_task_id, ur.user_id, v_system_user_id
          FROM user_roles ur
          WHERE ur.role IN ('admin', 'manager');
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$function$;