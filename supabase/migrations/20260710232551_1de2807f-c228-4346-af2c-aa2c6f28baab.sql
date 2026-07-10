-- Stamp the resolved tour-specific email template override onto status-change
-- queue rows at insert time, so the approvals UI and the actual send always agree.
CREATE OR REPLACE FUNCTION public.queue_status_change_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_tour_type text;
  v_skip_emails boolean;
  v_override_template_id uuid;
BEGIN
  -- Respect manual override (booking-level wins over tour-level)
  v_skip_emails := public.booking_skips_emails(NEW.id);
  IF v_skip_emails THEN
    RETURN NEW;
  END IF;

  SELECT tour_type INTO v_tour_type
  FROM public.tours
  WHERE id = NEW.tour_id;

  FOR v_rule IN 
    SELECT id, trigger_conditions
    FROM public.automated_email_rules
    WHERE is_active = true
      AND trigger_type = 'on_status_change'
      AND trigger_conditions IS NOT NULL
  LOOP
    IF public.evaluate_trigger_conditions(
      v_rule.trigger_conditions,
      NEW.status,
      v_tour_type,
      NEW.tour_id,
      NEW.passenger_count
    ) THEN
      -- Resolve any tour-specific template override for this rule/tour
      SELECT email_template_id INTO v_override_template_id
      FROM public.tour_email_rule_overrides
      WHERE tour_id = NEW.tour_id
        AND rule_id = v_rule.id
      LIMIT 1;

      INSERT INTO public.status_change_email_queue (
        rule_id, booking_id, tour_id, previous_status, new_status, email_template_id
      ) VALUES (
        v_rule.id, NEW.id, NEW.tour_id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status,
        v_override_template_id
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Backfill existing pending queue rows that have no queue-level override but do
-- have a tour-specific override configured, so their displayed template is correct.
UPDATE public.status_change_email_queue q
SET email_template_id = o.email_template_id
FROM public.tour_email_rule_overrides o
WHERE q.approval_status = 'pending'
  AND q.email_template_id IS NULL
  AND q.tour_id = o.tour_id
  AND q.rule_id = o.rule_id;