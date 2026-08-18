-- 1. Remove all direct table access for anon (guest pages use edge functions only)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','v','m','f')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
  END LOOP;
END $$;

-- 2. Remove authenticated access to server-only tables
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'ai_rate_limits','ai_usage','booking_assignments','capacity_monitoring_rules',
    'host_briefing_tokens','invoice_sync_dismissals','post_booking_email_log',
    'task_notification_log','teams_oauth_states','user_notification_dismissals',
    'wordpress_field_mappings','xero_api_locks'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', r);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r);
  END LOOP;
END $$;

-- 3. Restrict fabricated-record INSERT policies to service_role only
DROP POLICY IF EXISTS "System can insert profile updates" ON public.customer_profile_updates;
CREATE POLICY "Service role can insert profile updates"
  ON public.customer_profile_updates FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert email events" ON public.email_events;
CREATE POLICY "Service role can insert email events"
  ON public.email_events FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert email logs" ON public.email_logs;
CREATE POLICY "Service role can insert email logs"
  ON public.email_logs FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert automated email log" ON public.automated_email_log;
CREATE POLICY "Service role can insert automated email log"
  ON public.automated_email_log FOR INSERT TO service_role WITH CHECK (true);

-- 4. Lock down function execution: no EXECUTE for PUBLIC/anon; authenticated keeps
--    only RLS policy helpers and the functions the app actually calls.
DO $$
DECLARE
  r record;
  keep_names text[] := ARRAY[
    'generate_tour_operation_tasks','delete_automated_tour_tasks','log_sensitive_operation',
    'delete_booking_simple','delete_tour_with_cascade','generate_temp_password',
    'get_activity_allocation_discrepancies','has_role'
  ];
  policy_src text;
BEGIN
  SELECT coalesce(string_agg(coalesce(pg_get_expr(p.polqual, p.polrelid),'') || ' ' ||
                             coalesce(pg_get_expr(p.polwithcheck, p.polrelid),''), ' '), '')
    INTO policy_src FROM pg_policy p;

  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
    IF r.proname = ANY(keep_names) OR position(r.proname in policy_src) > 0 THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM authenticated', r.proname, r.args);
    END IF;
  END LOOP;
END $$;