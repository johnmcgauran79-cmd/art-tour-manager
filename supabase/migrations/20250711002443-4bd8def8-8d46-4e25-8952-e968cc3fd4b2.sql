-- Create a monitoring rule for pending bookings that stay unconfirmed for too long
INSERT INTO capacity_monitoring_rules (
    rule_name,
    rule_type,
    task_title_template,
    task_description_template,
    task_category,
    task_priority,
    is_active
) VALUES (
    'Pending Booking Follow-up',
    'pending_booking_followup',
    'Follow up on pending booking for [Tour Name]',
    'Booking has been pending for 7+ days. Please review and update status to invoiced, cancelled, or confirm if still pending. Lead passenger: [Lead Passenger]',
    'booking',
    'medium',
    true
);

-- Create a function to monitor pending bookings and create follow-up tasks
CREATE OR REPLACE FUNCTION public.create_pending_booking_task(p_booking_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking RECORD;
  v_customer RECORD;
  v_task_id UUID;
  v_title TEXT;
  v_description TEXT;
  v_system_user_id UUID;
BEGIN
  -- Get booking and tour details
  SELECT b.*, t.name as tour_name 
  INTO v_booking
  FROM bookings b
  JOIN tours t ON b.tour_id = t.id
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;
  
  -- Get customer details
  SELECT first_name, last_name, email
  INTO v_customer
  FROM customers
  WHERE id = v_booking.lead_passenger_id;
  
  -- Get a system user (first admin user for now)
  SELECT ur.user_id INTO v_system_user_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;
  
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found to assign automated task';
  END IF;
  
  -- Build task title and description
  v_title := 'Follow up on pending booking for ' || v_booking.tour_name;
  v_description := 'Booking has been pending for 7+ days. Please review and update status to invoiced, cancelled, or confirm if still pending.' ||
                   E'\n\nBooking Details:' ||
                   E'\n- Lead Passenger: ' || COALESCE(v_customer.first_name || ' ' || v_customer.last_name, 'Unknown') ||
                   E'\n- Email: ' || COALESCE(v_customer.email, 'Not provided') ||
                   E'\n- Tour: ' || v_booking.tour_name ||
                   E'\n- Passenger Count: ' || v_booking.passenger_count ||
                   E'\n- Booking Date: ' || to_char(v_booking.created_at, 'DD/MM/YYYY') ||
                   E'\n- Days Pending: ' || EXTRACT(DAY FROM now() - v_booking.created_at)::integer;
  
  -- Create the task
  INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    category,
    tour_id,
    created_by,
    is_automated,
    automated_rule,
    due_date
  ) VALUES (
    v_title,
    v_description,
    'not_started',
    'medium',
    'booking',
    v_booking.tour_id,
    v_system_user_id,
    true,
    'pending_booking_followup',
    now() + INTERVAL '1 day'  -- Due tomorrow
  ) RETURNING id INTO v_task_id;
  
  -- Auto-assign to booking agents and admins
  INSERT INTO task_assignments (task_id, user_id, assigned_by)
  SELECT v_task_id, ur.user_id, v_system_user_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'booking_agent');
  
  RETURN v_task_id;
END;
$function$;

-- Create a function that can be called via cron to check for pending bookings
CREATE OR REPLACE FUNCTION public.check_pending_bookings()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking_record RECORD;
  v_tasks_created INTEGER := 0;
BEGIN
  -- Find bookings that are still pending after 7 days and don't already have a follow-up task
  FOR v_booking_record IN 
    SELECT b.id, b.created_at
    FROM bookings b
    WHERE b.status = 'pending'
    AND b.created_at <= now() - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.automated_rule = 'pending_booking_followup'
      AND t.description LIKE '%Booking Date: ' || to_char(b.created_at, 'DD/MM/YYYY') || '%'
      AND t.status NOT IN ('completed', 'cancelled')
    )
  LOOP
    -- Create follow-up task for this booking
    PERFORM create_pending_booking_task(v_booking_record.id);
    v_tasks_created := v_tasks_created + 1;
    
    RAISE NOTICE 'Created follow-up task for pending booking: %', v_booking_record.id;
  END LOOP;
  
  -- Log the operation
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1),
    'PENDING_BOOKING_CHECK',
    'bookings',
    null,
    jsonb_build_object('tasks_created', v_tasks_created)
  );
  
  RETURN v_tasks_created;
END;
$function$;