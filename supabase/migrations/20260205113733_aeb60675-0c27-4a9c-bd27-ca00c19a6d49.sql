-- Add trigger_conditions JSONB column to automated_email_rules for flexible filtering
ALTER TABLE public.automated_email_rules 
ADD COLUMN IF NOT EXISTS trigger_conditions jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.automated_email_rules.trigger_conditions IS 
'Flexible conditions for event-based triggers. Structure: { "operator": "AND"|"OR", "conditions": [{ "field": "booking.status"|"tour.tour_type"|"tour.id"|"booking.passenger_count", "operator": "equals"|"not_equals"|"in"|"not_in"|"greater_than"|"less_than", "value": any, "values": array }], "groups": [nested condition groups] }';

-- Create queue table for status change emails (batch approval)
CREATE TABLE IF NOT EXISTS public.status_change_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automated_email_rules(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  previous_status text,
  new_status text NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  batch_date date NOT NULL DEFAULT CURRENT_DATE,
  processed_at timestamptz,
  approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'sent')),
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  email_log_id uuid REFERENCES public.email_logs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_status_change_queue_batch_date ON public.status_change_email_queue(batch_date);
CREATE INDEX IF NOT EXISTS idx_status_change_queue_rule_id ON public.status_change_email_queue(rule_id);
CREATE INDEX IF NOT EXISTS idx_status_change_queue_approval_status ON public.status_change_email_queue(approval_status);
CREATE INDEX IF NOT EXISTS idx_status_change_queue_booking_id ON public.status_change_email_queue(booking_id);

-- Create unique constraint to prevent duplicate queue entries for same booking/rule/date
CREATE UNIQUE INDEX IF NOT EXISTS idx_status_change_queue_unique 
ON public.status_change_email_queue(rule_id, booking_id, batch_date) 
WHERE approval_status = 'pending';

-- Enable RLS
ALTER TABLE public.status_change_email_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for status_change_email_queue
CREATE POLICY "Authenticated users can view status change queue"
ON public.status_change_email_queue FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert to status change queue"
ON public.status_change_email_queue FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update status change queue"
ON public.status_change_email_queue FOR UPDATE
TO authenticated
USING (true);

-- Function to evaluate trigger conditions against a booking
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
        RETURN false; -- Short circuit for AND
      END IF;
    ELSE
      v_result := v_result OR v_condition_met;
      IF v_result THEN
        RETURN true; -- Short circuit for OR
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to queue status change emails
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking status updates
DROP TRIGGER IF EXISTS booking_status_change_email_trigger ON public.bookings;
CREATE TRIGGER booking_status_change_email_trigger
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.queue_status_change_emails();

-- Create trigger for new bookings
DROP TRIGGER IF EXISTS booking_insert_status_email_trigger ON public.bookings;
CREATE TRIGGER booking_insert_status_email_trigger
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.queue_status_change_emails();