CREATE OR REPLACE FUNCTION public.create_capacity_monitoring_task(p_rule_type text, p_tour_id uuid DEFAULT NULL::uuid, p_hotel_id uuid DEFAULT NULL::uuid, p_activity_id uuid DEFAULT NULL::uuid, p_additional_context jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD;
  v_task_id UUID;
  v_title TEXT;
  v_description TEXT;
  v_system_user_id UUID;
  v_belinda_id CONSTANT UUID := '1ea92f6f-f7a6-4ecb-9b23-c137c2871f17';
  v_tara_id CONSTANT UUID := 'c8efb2b6-e7ef-4485-9aad-f6e12348cbac';
BEGIN
  SELECT * INTO v_rule 
  FROM capacity_monitoring_rules 
  WHERE rule_type = p_rule_type AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active monitoring rule found for type: %', p_rule_type;
  END IF;
  
  SELECT ur.user_id INTO v_system_user_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;
  
  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found to assign automated task';
  END IF;
  
  v_title := v_rule.task_title_template;
  v_description := v_rule.task_description_template;
  
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
  
  INSERT INTO tasks (
    title, description, status, priority, category, tour_id,
    created_by, is_automated, automated_rule
  ) VALUES (
    v_title, v_description, 'not_started', v_rule.task_priority, v_rule.task_category, p_tour_id,
    v_system_user_id, true, p_rule_type
  ) RETURNING id INTO v_task_id;
  
  -- Auto-assign only to Belinda Osborne and Tara Millena (Operations owners)
  INSERT INTO task_assignments (task_id, user_id, assigned_by)
  SELECT v_task_id, uid, v_system_user_id
  FROM (VALUES (v_belinda_id), (v_tara_id)) AS t(uid)
  WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = uid);
  
  RETURN v_task_id;
END;
$function$;