
CREATE OR REPLACE FUNCTION public.evaluate_trigger_conditions(
  p_conditions jsonb,
  p_booking_status text,
  p_tour_type text DEFAULT NULL,
  p_tour_id uuid DEFAULT NULL,
  p_passenger_count integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_condition RECORD;
  v_result boolean := true;
  v_status_match boolean;
  v_tour_match boolean;
  v_cond_result boolean;
  v_group_result boolean;
  v_top_operator text;
  v_any_condition boolean := false;
BEGIN
  -- Check if using new condition builder format (has "conditions" key)
  IF p_conditions ? 'conditions' AND jsonb_array_length(COALESCE(p_conditions->'conditions', '[]'::jsonb)) > 0 THEN
    v_top_operator := COALESCE(p_conditions->>'operator', 'AND');
    
    -- For OR: start false, any true makes it true
    -- For AND: start true, any false makes it false
    IF v_top_operator = 'OR' THEN
      v_result := false;
    ELSE
      v_result := true;
    END IF;

    FOR v_condition IN SELECT value FROM jsonb_array_elements(p_conditions->'conditions') AS value
    LOOP
      v_any_condition := true;
      v_cond_result := false;
      
      -- Evaluate individual condition
      IF v_condition.value->>'field' = 'booking.status' THEN
        IF v_condition.value->>'operator' = 'in' THEN
          SELECT EXISTS(
            SELECT 1 FROM jsonb_array_elements_text(v_condition.value->'values') AS val
            WHERE val = p_booking_status
          ) INTO v_cond_result;
        ELSIF v_condition.value->>'operator' = 'equals' THEN
          v_cond_result := (v_condition.value->>'value' = p_booking_status);
        ELSIF v_condition.value->>'operator' = 'not_equals' THEN
          v_cond_result := (v_condition.value->>'value' != p_booking_status);
        END IF;
        
      ELSIF v_condition.value->>'field' = 'tour.tour_type' THEN
        IF v_condition.value->>'operator' = 'in' THEN
          SELECT EXISTS(
            SELECT 1 FROM jsonb_array_elements_text(v_condition.value->'values') AS val
            WHERE val = p_tour_type
          ) INTO v_cond_result;
        ELSIF v_condition.value->>'operator' = 'equals' THEN
          v_cond_result := (v_condition.value->>'value' = p_tour_type);
        END IF;
        
      ELSIF v_condition.value->>'field' = 'tour.id' THEN
        IF v_condition.value->>'operator' = 'in' THEN
          SELECT EXISTS(
            SELECT 1 FROM jsonb_array_elements_text(v_condition.value->'values') AS val
            WHERE val::uuid = p_tour_id
          ) INTO v_cond_result;
        ELSIF v_condition.value->>'operator' = 'equals' THEN
          v_cond_result := (v_condition.value->>'value')::uuid = p_tour_id;
        END IF;
        
      ELSIF v_condition.value->>'field' = 'booking.passenger_count' THEN
        IF v_condition.value->>'operator' = 'equals' THEN
          v_cond_result := p_passenger_count = (v_condition.value->>'value')::integer;
        ELSIF v_condition.value->>'operator' = 'greater_than' THEN
          v_cond_result := p_passenger_count > (v_condition.value->>'value')::integer;
        ELSIF v_condition.value->>'operator' = 'less_than' THEN
          v_cond_result := p_passenger_count < (v_condition.value->>'value')::integer;
        END IF;
      END IF;

      -- Combine with operator
      IF v_top_operator = 'OR' THEN
        v_result := v_result OR v_cond_result;
      ELSE
        v_result := v_result AND v_cond_result;
      END IF;
    END LOOP;

    -- If no conditions were found, default to true
    IF NOT v_any_condition THEN
      v_result := true;
    END IF;

    RETURN v_result;
  END IF;

  -- Legacy format: simple "statuses" array at root level
  IF p_conditions ? 'statuses' AND jsonb_array_length(p_conditions->'statuses') > 0 THEN
    v_status_match := false;
    FOR v_condition IN SELECT jsonb_array_elements_text(p_conditions->'statuses') as status_val
    LOOP
      IF v_condition.status_val = p_booking_status THEN
        v_status_match := true;
        EXIT;
      END IF;
    END LOOP;
    v_result := v_result AND v_status_match;
  END IF;

  -- Legacy: Check tour type conditions
  IF p_conditions ? 'tour_types' AND jsonb_array_length(p_conditions->'tour_types') > 0 THEN
    v_tour_match := false;
    FOR v_condition IN SELECT jsonb_array_elements_text(p_conditions->'tour_types') as tour_type_val
    LOOP
      IF v_condition.tour_type_val = p_tour_type THEN
        v_tour_match := true;
        EXIT;
      END IF;
    END LOOP;
    v_result := v_result AND v_tour_match;
  END IF;

  -- Legacy: Check specific tour IDs
  IF p_conditions ? 'tour_ids' AND jsonb_array_length(p_conditions->'tour_ids') > 0 THEN
    v_tour_match := false;
    FOR v_condition IN SELECT jsonb_array_elements_text(p_conditions->'tour_ids') as tour_id_val
    LOOP
      IF v_condition.tour_id_val::uuid = p_tour_id THEN
        v_tour_match := true;
        EXIT;
      END IF;
    END LOOP;
    v_result := v_result AND v_tour_match;
  END IF;

  -- Legacy: Check passenger count conditions
  IF p_conditions ? 'min_passengers' THEN
    v_result := v_result AND (p_passenger_count >= (p_conditions->>'min_passengers')::integer);
  END IF;

  IF p_conditions ? 'max_passengers' THEN
    v_result := v_result AND (p_passenger_count <= (p_conditions->>'max_passengers')::integer);
  END IF;

  RETURN v_result;
END;
$$;

-- Also update the enum overload
CREATE OR REPLACE FUNCTION public.evaluate_trigger_conditions(
  p_conditions jsonb,
  p_booking_status public.booking_status,
  p_tour_type text DEFAULT NULL,
  p_tour_id uuid DEFAULT NULL,
  p_passenger_count integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.evaluate_trigger_conditions(
    p_conditions,
    p_booking_status::text,
    p_tour_type,
    p_tour_id,
    p_passenger_count
  );
END;
$$;
