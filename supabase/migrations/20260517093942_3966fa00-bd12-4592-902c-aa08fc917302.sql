
-- 1. Add optional host_user_id to automated_email_log for per-host tracking
ALTER TABLE public.automated_email_log
  ADD COLUMN IF NOT EXISTS host_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_automated_email_log_host
  ON public.automated_email_log(tour_id, rule_id, host_user_id)
  WHERE host_user_id IS NOT NULL;

-- 2. Create host_briefing_tokens table
CREATE TABLE IF NOT EXISTS public.host_briefing_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_host_briefing_tokens_token
  ON public.host_briefing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_host_briefing_tokens_tour_host
  ON public.host_briefing_tokens(tour_id, host_user_id);

ALTER TABLE public.host_briefing_tokens ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view all tokens
CREATE POLICY "Admins and managers can view host briefing tokens"
ON public.host_briefing_tokens
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Hosts can view their own tokens
CREATE POLICY "Hosts can view their own briefing tokens"
ON public.host_briefing_tokens
FOR SELECT
TO authenticated
USING (host_user_id = auth.uid());

-- Validation trigger to ensure expires_at is in the future on insert
CREATE OR REPLACE FUNCTION public.validate_host_briefing_token_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_host_briefing_token_expiry_trg ON public.host_briefing_tokens;
CREATE TRIGGER validate_host_briefing_token_expiry_trg
BEFORE INSERT ON public.host_briefing_tokens
FOR EACH ROW EXECUTE FUNCTION public.validate_host_briefing_token_expiry();

-- Add to delete_tour_with_cascade
CREATE OR REPLACE FUNCTION public.delete_tour_with_cascade(p_tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete scheduled emails
  DELETE FROM scheduled_emails WHERE tour_id = p_tour_id;
  DELETE FROM scheduled_emails WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);

  -- Delete automated email log entries
  DELETE FROM automated_email_log WHERE tour_id = p_tour_id;
  DELETE FROM automated_email_log WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete automated report log entries
  DELETE FROM automated_report_log WHERE tour_id = p_tour_id;
  
  -- Delete status change email queue
  DELETE FROM status_change_email_queue WHERE tour_id = p_tour_id;
  
  -- Delete email logs
  DELETE FROM email_logs WHERE tour_id = p_tour_id;
  
  -- Delete tour alerts
  DELETE FROM tour_alerts WHERE tour_id = p_tour_id;
  
  -- Delete host briefing tokens
  DELETE FROM host_briefing_tokens WHERE tour_id = p_tour_id;
  
  -- Delete customer access tokens for bookings on this tour
  DELETE FROM customer_access_tokens WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking waivers
  DELETE FROM booking_waivers WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking travel docs
  DELETE FROM booking_travel_docs WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking comments
  DELETE FROM booking_comments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking assignments
  DELETE FROM booking_assignments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete hotel bookings
  DELETE FROM hotel_bookings WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete activity bookings
  DELETE FROM activity_bookings WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM activity_bookings WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  
  -- Delete bookings
  DELETE FROM bookings WHERE tour_id = p_tour_id;
  
  -- Delete activity journeys
  DELETE FROM activity_journeys WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  
  -- Delete activity attachments
  DELETE FROM activity_attachments WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  
  -- Delete activities
  DELETE FROM activities WHERE tour_id = p_tour_id;
  
  -- Delete hotel attachments
  DELETE FROM hotel_attachments WHERE hotel_id IN (SELECT id FROM hotels WHERE tour_id = p_tour_id);
  
  -- Delete hotels
  DELETE FROM hotels WHERE tour_id = p_tour_id;
  
  -- Delete task assignments, comments, attachments for tour tasks
  DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_dependencies WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id) 
     OR depends_on_task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  
  -- Delete tasks
  DELETE FROM tasks WHERE tour_id = p_tour_id;
  
  -- Delete tour host assignments
  DELETE FROM tour_host_assignments WHERE tour_id = p_tour_id;
  
  -- Delete tour attachments
  DELETE FROM tour_attachments WHERE tour_id = p_tour_id;
  
  -- Delete tour pickup options
  DELETE FROM tour_pickup_options WHERE tour_id = p_tour_id;
  
  -- Delete tour custom form responses and forms
  DELETE FROM custom_form_responses WHERE form_id IN (SELECT id FROM tour_custom_forms WHERE tour_id = p_tour_id);
  DELETE FROM tour_custom_forms WHERE tour_id = p_tour_id;
  
  -- Delete tour itinerary entries
  DELETE FROM tour_itinerary_entries WHERE tour_id = p_tour_id;
  
  -- Delete tour external links
  DELETE FROM tour_external_links WHERE tour_id = p_tour_id;
  
  -- Finally delete the tour
  DELETE FROM tours WHERE id = p_tour_id;
  
  -- Log the operation
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'DELETE_TOUR_CASCADE',
    'tours',
    p_tour_id,
    jsonb_build_object('cascade', true)
  );
END;
$function$;
