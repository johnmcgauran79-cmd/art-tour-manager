
-- Create enum types for task management
CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'waiting', 'completed', 'cancelled');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.task_category AS ENUM ('booking', 'operations', 'finance', 'marketing', 'maintenance', 'general');

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'not_started',
  priority task_priority NOT NULL DEFAULT 'medium',
  category task_category NOT NULL DEFAULT 'general',
  due_date TIMESTAMP WITH TIME ZONE,
  tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_automated BOOLEAN NOT NULL DEFAULT false,
  automated_rule TEXT, -- stores the rule that created this task
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task assignments table for multiple assignees
CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create task comments table for collaboration
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task templates table for reusable workflows
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  category task_category NOT NULL DEFAULT 'general',
  days_before_tour INTEGER, -- when to create this task relative to tour start
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create capacity monitoring rules table
CREATE TABLE public.capacity_monitoring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'hotel_overbooking', 'activity_oversold', etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  task_title_template TEXT NOT NULL,
  task_description_template TEXT,
  task_priority task_priority NOT NULL DEFAULT 'high',
  task_category task_category NOT NULL DEFAULT 'operations',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_monitoring_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks - users can see tasks they're assigned to or created
CREATE POLICY "Users can view assigned tasks" ON public.tasks
FOR SELECT USING (
  auth.uid() = created_by OR 
  auth.uid() IN (SELECT user_id FROM public.task_assignments WHERE task_id = tasks.id)
);

CREATE POLICY "Users can create tasks" ON public.tasks
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Assigned users can update tasks" ON public.tasks
FOR UPDATE USING (
  auth.uid() = created_by OR 
  auth.uid() IN (SELECT user_id FROM public.task_assignments WHERE task_id = tasks.id)
);

-- RLS policies for task assignments
CREATE POLICY "Users can view task assignments" ON public.task_assignments
FOR SELECT USING (
  auth.uid() = user_id OR 
  auth.uid() = assigned_by OR
  auth.uid() IN (SELECT created_by FROM public.tasks WHERE id = task_assignments.task_id)
);

CREATE POLICY "Users can create task assignments" ON public.task_assignments
FOR INSERT WITH CHECK (
  auth.uid() = assigned_by OR
  auth.uid() IN (SELECT created_by FROM public.tasks WHERE id = task_assignments.task_id)
);

-- RLS policies for task comments
CREATE POLICY "Users can view task comments for assigned tasks" ON public.task_comments
FOR SELECT USING (
  auth.uid() = user_id OR
  auth.uid() IN (SELECT user_id FROM public.task_assignments WHERE task_id = task_comments.task_id) OR
  auth.uid() IN (SELECT created_by FROM public.tasks WHERE id = task_comments.task_id)
);

CREATE POLICY "Users can create comments on assigned tasks" ON public.task_comments
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    auth.uid() IN (SELECT user_id FROM public.task_assignments WHERE task_id = task_comments.task_id) OR
    auth.uid() IN (SELECT created_by FROM public.tasks WHERE id = task_comments.task_id)
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON public.task_templates
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Function to create automated tasks for capacity issues
CREATE OR REPLACE FUNCTION public.create_capacity_monitoring_task(
  p_rule_type TEXT,
  p_tour_id UUID DEFAULT NULL,
  p_hotel_id UUID DEFAULT NULL,
  p_activity_id UUID DEFAULT NULL,
  p_additional_context JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_task_id UUID;
  v_title TEXT;
  v_description TEXT;
  v_system_user_id UUID;
BEGIN
  -- Get the monitoring rule
  SELECT * INTO v_rule 
  FROM capacity_monitoring_rules 
  WHERE rule_type = p_rule_type AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active monitoring rule found for type: %', p_rule_type;
  END IF;
  
  -- Get a system user (first admin user for now)
  SELECT ur.user_id INTO v_system_user_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;
  
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found to assign automated task';
  END IF;
  
  -- Build task title and description with context
  v_title := v_rule.task_title_template;
  v_description := v_rule.task_description_template;
  
  -- Replace placeholders with actual data
  IF p_tour_id IS NOT NULL THEN
    v_title := REPLACE(v_title, '[Tour Name]', (SELECT name FROM tours WHERE id = p_tour_id));
    v_description := REPLACE(v_description, '[Tour Name]', (SELECT name FROM tours WHERE id = p_tour_id));
  END IF;
  
  IF p_hotel_id IS NOT NULL THEN
    v_title := REPLACE(v_title, '[Hotel Name]', (SELECT name FROM hotels WHERE id = p_hotel_id));
    v_description := REPLACE(v_description, '[Hotel Name]', (SELECT name FROM hotels WHERE id = p_hotel_id));
  END IF;
  
  IF p_activity_id IS NOT NULL THEN
    v_title := REPLACE(v_title, '[Activity Name]', (SELECT name FROM activities WHERE id = p_activity_id));
    v_description := REPLACE(v_description, '[Activity Name]', (SELECT name FROM activities WHERE id = p_activity_id));
  END IF;
  
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
    automated_rule
  ) VALUES (
    v_title,
    v_description,
    'not_started',
    v_rule.task_priority,
    v_rule.task_category,
    p_tour_id,
    v_system_user_id,
    true,
    p_rule_type
  ) RETURNING id INTO v_task_id;
  
  -- Auto-assign to managers/admins
  INSERT INTO task_assignments (task_id, user_id, assigned_by)
  SELECT v_task_id, ur.user_id, v_system_user_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'manager');
  
  RETURN v_task_id;
END;
$$;

-- Insert default monitoring rules
INSERT INTO public.capacity_monitoring_rules (rule_name, rule_type, task_title_template, task_description_template, task_priority, task_category) VALUES
('Hotel Overbooking Alert', 'hotel_overbooking', 'Secure additional rooms at [Hotel Name]', 'Hotel [Hotel Name] has more bookings than reserved rooms. Immediate action required to secure additional accommodation.', 'critical', 'operations'),
('Activity Oversold Alert', 'activity_oversold', 'Increase capacity for [Activity Name]', 'Activity [Activity Name] has more bookings than available spots. Contact provider to increase capacity or find alternative.', 'high', 'operations'),
('Tour Overcapacity Alert', 'tour_overcapacity', 'Review passenger allocations for [Tour Name]', 'Tour [Tour Name] has exceeded its maximum capacity. Review bookings and make necessary adjustments.', 'high', 'operations'),
('Payment Deadline Alert', 'payment_overdue', 'Follow up overdue payment for [Tour Name]', 'Payment deadline has passed for [Tour Name]. Follow up with outstanding customers immediately.', 'high', 'finance'),
('Hotel Cutoff Date Alert', 'hotel_cutoff_approaching', 'Confirm final room numbers for [Hotel Name]', 'Hotel cutoff date approaching for [Hotel Name]. Confirm final room requirements and make any necessary adjustments.', 'medium', 'operations');

-- Function to monitor hotel capacity and create tasks
CREATE OR REPLACE FUNCTION public.monitor_hotel_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for hotel overbooking
  IF NEW.rooms_booked > NEW.rooms_reserved THEN
    -- Check if a task already exists for this issue
    IF NOT EXISTS (
      SELECT 1 FROM tasks 
      WHERE tour_id = NEW.tour_id 
      AND automated_rule = 'hotel_overbooking'
      AND status NOT IN ('completed', 'cancelled')
      AND title LIKE '%' || NEW.name || '%'
    ) THEN
      PERFORM create_capacity_monitoring_task(
        'hotel_overbooking',
        NEW.tour_id,
        NEW.id,
        NULL,
        jsonb_build_object('rooms_booked', NEW.rooms_booked, 'rooms_reserved', NEW.rooms_reserved)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to monitor activity capacity and create tasks  
CREATE OR REPLACE FUNCTION public.monitor_activity_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for activity overselling
  IF NEW.spots_booked > NEW.spots_available THEN
    -- Check if a task already exists for this issue
    IF NOT EXISTS (
      SELECT 1 FROM tasks 
      WHERE tour_id = NEW.tour_id 
      AND automated_rule = 'activity_oversold'
      AND status NOT IN ('completed', 'cancelled')
      AND title LIKE '%' || NEW.name || '%'
    ) THEN
      PERFORM create_capacity_monitoring_task(
        'activity_oversold',
        NEW.tour_id,
        NULL,
        NEW.id,
        jsonb_build_object('spots_booked', NEW.spots_booked, 'spots_available', NEW.spots_available)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for capacity monitoring
CREATE TRIGGER hotel_capacity_monitor
  AFTER UPDATE ON public.hotels
  FOR EACH ROW
  WHEN (NEW.rooms_booked IS DISTINCT FROM OLD.rooms_booked OR NEW.rooms_reserved IS DISTINCT FROM OLD.rooms_reserved)
  EXECUTE FUNCTION monitor_hotel_capacity();

CREATE TRIGGER activity_capacity_monitor
  AFTER UPDATE ON public.activities
  FOR EACH ROW
  WHEN (NEW.spots_booked IS DISTINCT FROM OLD.spots_booked OR NEW.spots_available IS DISTINCT FROM OLD.spots_available)
  EXECUTE FUNCTION monitor_activity_capacity();
