
-- Enable real-time functionality for tasks table
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

-- Add tasks table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Create automated tour operations task templates
INSERT INTO public.task_templates (name, description, category, priority, days_before_tour, is_active) VALUES
('Final Payment Reminder', 'Send final payment reminders to all passengers', 'finance', 'high', 30, true),
('Hotel Booking Confirmation', 'Confirm all hotel bookings and room allocations', 'operations', 'critical', 21, true),
('Activity Booking Confirmation', 'Confirm all activity bookings and capacity', 'operations', 'high', 14, true),
('Travel Document Check', 'Verify all passenger travel documents', 'operations', 'critical', 14, true),
('Emergency Contact Collection', 'Collect emergency contacts from all passengers', 'operations', 'medium', 10, true),
('Final Passenger List', 'Generate and distribute final passenger list', 'operations', 'high', 7, true),
('Tour Guide Briefing', 'Brief tour guide on itinerary and passenger needs', 'operations', 'high', 3, true),
('Welcome Package Preparation', 'Prepare welcome packages and tour materials', 'operations', 'medium', 2, true);

-- Create function to auto-generate tour operation tasks
CREATE OR REPLACE FUNCTION public.generate_tour_operation_tasks(p_tour_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tour RECORD;
  v_template RECORD;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_system_user_id UUID;
BEGIN
  -- Get tour details
  SELECT * INTO v_tour FROM tours WHERE id = p_tour_id;
  
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
    -- Calculate due date
    v_due_date := v_tour.start_date - INTERVAL '1 day' * v_template.days_before_tour;
    
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
          v_template.description || ' for ' || v_tour.name,
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
  END LOOP;
END;
$$;

-- Create trigger to auto-generate tasks when tour is created
CREATE OR REPLACE FUNCTION public.handle_new_tour()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Generate tour operation tasks for the new tour
  PERFORM generate_tour_operation_tasks(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger for new tours
DROP TRIGGER IF EXISTS trigger_new_tour ON public.tours;
CREATE TRIGGER trigger_new_tour
  AFTER INSERT ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_tour();

-- Create function to regenerate tasks when tour dates change
CREATE OR REPLACE FUNCTION public.handle_tour_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only regenerate if start_date changed
  IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
    -- Archive existing automated tour operation tasks
    UPDATE tasks 
    SET status = 'archived'
    WHERE tour_id = NEW.id 
    AND is_automated = true 
    AND automated_rule LIKE 'tour_operations_%'
    AND status NOT IN ('completed', 'cancelled');
    
    -- Generate new tasks with updated dates
    PERFORM generate_tour_operation_tasks(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for tour date changes
DROP TRIGGER IF EXISTS trigger_tour_date_change ON public.tours;
CREATE TRIGGER trigger_tour_date_change
  AFTER UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION handle_tour_date_change();

-- Enable real-time for other relevant tables
ALTER TABLE public.task_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
ALTER TABLE public.tours REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tours;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
