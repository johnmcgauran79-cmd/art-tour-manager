-- 1. Add manual override flags to tours
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS manual_billing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_emails boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tours.manual_billing IS 'When true, skip Xero invoice creation and Keap tagging for all bookings on this tour (unless booking explicitly forces automated).';
COMMENT ON COLUMN public.tours.manual_emails IS 'When true, skip all automated emails (status-change, time-based rules, scheduled) for this tour (unless booking explicitly forces automated).';

-- 2. Add per-booking override
DO $$ BEGIN
  CREATE TYPE public.booking_automation_override AS ENUM (
    'inherit',
    'force_automated',
    'manual_billing',
    'manual_emails',
    'manual_all'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS automation_override public.booking_automation_override NOT NULL DEFAULT 'inherit';

COMMENT ON COLUMN public.bookings.automation_override IS 'Per-booking automation control. inherit = follow tour settings; force_automated = always automate even if tour is manual; manual_billing = skip Xero+Keap; manual_emails = skip automated emails; manual_all = skip both.';

-- 3. Helper functions used by triggers and edge functions
CREATE OR REPLACE FUNCTION public.booking_skips_billing(_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN b.automation_override = 'force_automated' THEN false
      WHEN b.automation_override IN ('manual_billing', 'manual_all') THEN true
      WHEN b.automation_override = 'manual_emails' THEN COALESCE(t.manual_billing, false)
      ELSE COALESCE(t.manual_billing, false) -- inherit
    END
  FROM public.bookings b
  LEFT JOIN public.tours t ON t.id = b.tour_id
  WHERE b.id = _booking_id;
$$;

CREATE OR REPLACE FUNCTION public.booking_skips_emails(_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN b.automation_override = 'force_automated' THEN false
      WHEN b.automation_override IN ('manual_emails', 'manual_all') THEN true
      WHEN b.automation_override = 'manual_billing' THEN COALESCE(t.manual_emails, false)
      ELSE COALESCE(t.manual_emails, false) -- inherit
    END
  FROM public.bookings b
  LEFT JOIN public.tours t ON t.id = b.tour_id
  WHERE b.id = _booking_id;
$$;

-- 4. Update queue_status_change_emails trigger to respect manual_emails
CREATE OR REPLACE FUNCTION public.queue_status_change_emails()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD;
  v_tour_type text;
  v_skip_emails boolean;
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
      INSERT INTO public.status_change_email_queue (
        rule_id, booking_id, tour_id, previous_status, new_status
      ) VALUES (
        v_rule.id, NEW.id, NEW.tour_id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 5. Indexes for fast lookup of overridden tours/bookings
CREATE INDEX IF NOT EXISTS idx_tours_manual_billing ON public.tours(manual_billing) WHERE manual_billing = true;
CREATE INDEX IF NOT EXISTS idx_tours_manual_emails ON public.tours(manual_emails) WHERE manual_emails = true;
CREATE INDEX IF NOT EXISTS idx_bookings_automation_override ON public.bookings(automation_override) WHERE automation_override <> 'inherit';