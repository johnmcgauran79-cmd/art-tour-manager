CREATE OR REPLACE FUNCTION public.evaluate_trigger_conditions(
  p_conditions jsonb,
  p_booking_status text,
  p_tour_type text,
  p_tour_id uuid,
  p_passenger_count integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_condition RECORD;
  v_result boolean := true;
  v_status_match boolean;
  v_tour_match boolean;
BEGIN
  -- Check status conditions
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

  -- Check tour type conditions
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

  -- Check specific tour IDs
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

  -- Check passenger count conditions
  IF p_conditions ? 'min_passengers' THEN
    v_result := v_result AND (p_passenger_count >= (p_conditions->>'min_passengers')::integer);
  END IF;

  IF p_conditions ? 'max_passengers' THEN
    v_result := v_result AND (p_passenger_count <= (p_conditions->>'max_passengers')::integer);
  END IF;

  RETURN v_result;
END;
$function$;

-- Also create an overload that accepts the booking_status enum directly
CREATE OR REPLACE FUNCTION public.evaluate_trigger_conditions(
  p_conditions jsonb,
  p_booking_status public.booking_status,
  p_tour_type text,
  p_tour_id uuid,
  p_passenger_count integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delegate to the text version by casting
  RETURN public.evaluate_trigger_conditions(
    p_conditions,
    p_booking_status::text,
    p_tour_type,
    p_tour_id,
    p_passenger_count
  );
END;
$function$;