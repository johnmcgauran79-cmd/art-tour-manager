-- Fix search_path for evaluate_trigger_conditions function
CREATE OR REPLACE FUNCTION public.evaluate_trigger_conditions(
  p_conditions jsonb,
  p_booking_status text,
  p_tour_type text,
  p_tour_id uuid,
  p_passenger_count integer
) RETURNS boolean AS $$
DECLARE
  v_operator text;
  v_conditions jsonb;
  v_groups jsonb;
  v_condition jsonb;
  v_group jsonb;
  v_field text;
  v_cond_operator text;
  v_value text;
  v_values text[];
  v_result boolean;
  v_group_result boolean;
  v_condition_met boolean;
BEGIN
  -- If no conditions, return true (matches all)
  IF p_conditions IS NULL OR p_conditions = '{}'::jsonb THEN
    RETURN true;
  END IF;

  v_operator := COALESCE(p_conditions->>'operator', 'AND');
  v_conditions := COALESCE(p_conditions->'conditions', '[]'::jsonb);
  v_groups := COALESCE(p_conditions->'groups', '[]'::jsonb);

  -- Initialize result based on operator
  IF v_operator = 'AND' THEN
    v_result := true;
  ELSE
    v_result := false;
  END IF;

  -- Evaluate individual conditions
  FOR v_condition IN SELECT * FROM jsonb_array_elements(v_conditions)
  LOOP
    v_field := v_condition->>'field';
    v_cond_operator := v_condition->>'operator';
    v_value := v_condition->>'value';
    
    -- Get values array if present
    IF v_condition->'values' IS NOT NULL THEN
      SELECT array_agg(val::text) INTO v_values
      FROM jsonb_array_elements_text(v_condition->'values') AS val;
    ELSE
      v_values := ARRAY[]::text[];
    END IF;

    -- Evaluate based on field
    CASE v_field
      WHEN 'booking.status' THEN
        CASE v_cond_operator
          WHEN 'equals' THEN v_condition_met := p_booking_status = v_value;
          WHEN 'not_equals' THEN v_condition_met := p_booking_status != v_value;
          WHEN 'in' THEN v_condition_met := p_booking_status = ANY(v_values);
          WHEN 'not_in' THEN v_condition_met := NOT (p_booking_status = ANY(v_values));
          ELSE v_condition_met := false;
        END CASE;
      
      WHEN 'tour.tour_type' THEN
        CASE v_cond_operator
          WHEN 'equals' THEN v_condition_met := p_tour_type = v_value;
          WHEN 'not_equals' THEN v_condition_met := p_tour_type != v_value;
          WHEN 'in' THEN v_condition_met := p_tour_type = ANY(v_values);
          WHEN 'not_in' THEN v_condition_met := NOT (p_tour_type = ANY(v_values));
          ELSE v_condition_met := false;
        END CASE;
      
      WHEN 'tour.id' THEN
        CASE v_cond_operator
          WHEN 'equals' THEN v_condition_met := p_tour_id::text = v_value;
          WHEN 'not_equals' THEN v_condition_met := p_tour_id::text != v_value;
          WHEN 'in' THEN v_condition_met := p_tour_id::text = ANY(v_values);
          WHEN 'not_in' THEN v_condition_met := NOT (p_tour_id::text = ANY(v_values));
          ELSE v_condition_met := false;
        END CASE;
      
      WHEN 'booking.passenger_count' THEN
        CASE v_cond_operator
          WHEN 'equals' THEN v_condition_met := p_passenger_count = v_value::integer;
          WHEN 'not_equals' THEN v_condition_met := p_passenger_count != v_value::integer;
          WHEN 'greater_than' THEN v_condition_met := p_passenger_count > v_value::integer;
          WHEN 'less_than' THEN v_condition_met := p_passenger_count < v_value::integer;
          ELSE v_condition_met := false;
        END CASE;
      
      ELSE
        v_condition_met := false;
    END CASE;

    -- Apply operator logic
    IF v_operator = 'AND' THEN
      v_result := v_result AND v_condition_met;
      IF NOT v_result THEN
        RETURN false;
      END IF;
    ELSE
      v_result := v_result OR v_condition_met;
      IF v_result THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  -- Evaluate nested groups recursively
  FOR v_group IN SELECT * FROM jsonb_array_elements(v_groups)
  LOOP
    v_group_result := public.evaluate_trigger_conditions(
      v_group,
      p_booking_status,
      p_tour_type,
      p_tour_id,
      p_passenger_count
    );

    IF v_operator = 'AND' THEN
      v_result := v_result AND v_group_result;
      IF NOT v_result THEN
        RETURN false;
      END IF;
    ELSE
      v_result := v_result OR v_group_result;
      IF v_result THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Fix search_path for queue_status_change_emails function
CREATE OR REPLACE FUNCTION public.queue_status_change_emails()
RETURNS TRIGGER AS $$
DECLARE
  v_rule RECORD;
  v_tour_type text;
BEGIN
  -- Get tour type
  SELECT tour_type INTO v_tour_type
  FROM public.tours
  WHERE id = NEW.tour_id;

  -- Find matching rules with trigger_type = 'on_status_change'
  FOR v_rule IN 
    SELECT id, trigger_conditions
    FROM public.automated_email_rules
    WHERE is_active = true
      AND trigger_type = 'on_status_change'
      AND trigger_conditions IS NOT NULL
  LOOP
    -- Evaluate conditions
    IF public.evaluate_trigger_conditions(
      v_rule.trigger_conditions,
      NEW.status,
      v_tour_type,
      NEW.tour_id,
      NEW.passenger_count
    ) THEN
      -- Queue the email (ignore duplicates for same day)
      INSERT INTO public.status_change_email_queue (
        rule_id,
        booking_id,
        tour_id,
        previous_status,
        new_status
      ) VALUES (
        v_rule.id,
        NEW.id,
        NEW.tour_id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;