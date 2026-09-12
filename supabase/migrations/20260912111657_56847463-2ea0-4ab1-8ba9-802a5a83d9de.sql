CREATE OR REPLACE FUNCTION public.get_system_health_service()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '25s'
AS $function$
  WITH job_fail AS (
    SELECT r.jobid, count(*)::int AS cnt, max(r.return_message) AS msg
    FROM cron.job_run_details r
    WHERE r.start_time > now() - interval '24 hours' AND r.status <> 'succeeded'
    GROUP BY r.jobid
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'stale_backup_hours', (SELECT (extract(epoch FROM (now() - max(finished_at)))/3600)::numeric(10,1) FROM public.backup_runs WHERE status='success'),
    'failed_jobs_24h', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('jobname', j.jobname, 'failures', f.cnt, 'message', left(coalesce(f.msg,''),300))), '[]'::jsonb)
      FROM job_fail f JOIN cron.job j ON j.jobid = f.jobid
    ),
    'http_failures_24h', (SELECT count(*)::int FROM net._http_response WHERE created > now() - interval '24 hours' AND (status_code IS NULL OR status_code >= 400)),
    'mailbox_failures', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('mailbox', m.address, 'status', r.status, 'error', left(coalesce(r.error_message,''),300))), '[]'::jsonb)
      FROM public.email_mailboxes m
      JOIN LATERAL (
        SELECT sr.status, sr.error_message FROM public.email_sync_runs sr WHERE sr.mailbox_id = m.id ORDER BY sr.created_at DESC LIMIT 1
      ) r ON true
      WHERE coalesce(m.sync_enabled, false)
        AND lower(coalesce(r.status,'')) NOT IN ('success','completed','ok','running','in_progress')
    ),
    'xero_failures_24h', (SELECT count(*)::int FROM public.xero_sync_log WHERE created_at > now() - interval '24 hours' AND lower(coalesce(status,'')) IN ('error','failed')),
    'crm_failures_24h', (SELECT count(*)::int FROM public.crm_automation_runs WHERE created_at > now() - interval '24 hours' AND success IS FALSE),
    'marketing_failures_24h', (SELECT count(*)::int FROM public.marketing_automation_log WHERE created_at > now() - interval '24 hours' AND success IS FALSE),
    'email_failures_24h', (SELECT count(*)::int FROM public.email_logs WHERE created_at > now() - interval '24 hours' AND error_message IS NOT NULL)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_system_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '25s'
AS $function$
DECLARE
  v_jobs jsonb;
  v_http jsonb;
  v_backup jsonb;
  v_backup_hours numeric;
  v_mailboxes jsonb;
  v_xero_failures integer;
  v_crm_failures integer;
  v_marketing_failures integer;
  v_email_failures integer;
  v_problems integer := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH last_run AS (
    SELECT DISTINCT ON (r.jobid) r.jobid, r.start_time, r.status, r.return_message
    FROM cron.job_run_details r
    ORDER BY r.jobid, r.start_time DESC
  ), fails AS (
    SELECT r.jobid, count(*)::int AS cnt
    FROM cron.job_run_details r
    WHERE r.start_time > now() - interval '24 hours' AND r.status <> 'succeeded'
    GROUP BY r.jobid
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'jobname', j.jobname,
      'schedule', j.schedule,
      'active', j.active,
      'target', substring(j.command from 'functions/v1/([a-z0-9-]+)'),
      'last_run', d.start_time,
      'last_status', d.status,
      'last_message', left(coalesce(d.return_message, ''), 300),
      'failures_24h', coalesce(f.cnt, 0)
    ) ORDER BY j.jobname), '[]'::jsonb) INTO v_jobs
  FROM cron.job j
  LEFT JOIN last_run d ON d.jobid = j.jobid
  LEFT JOIN fails f ON f.jobid = j.jobid;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_http
  FROM (
    SELECT jsonb_build_object(
      'created', r.created,
      'status_code', r.status_code,
      'error', left(coalesce(r.error_msg, ''), 300)
    ) AS x
    FROM net._http_response r
    WHERE r.created > now() - interval '24 hours'
      AND (r.status_code IS NULL OR r.status_code >= 400)
    ORDER BY r.created DESC
    LIMIT 20
  ) s;

  SELECT to_jsonb(b) INTO v_backup
  FROM (
    SELECT status, finished_at, size_bytes, destination, error_message
    FROM public.backup_runs
    ORDER BY finished_at DESC
    LIMIT 1
  ) b;

  SELECT (extract(epoch FROM (now() - max(finished_at))) / 3600)::numeric(10,1)
  INTO v_backup_hours
  FROM public.backup_runs WHERE status = 'success';

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'mailbox'), '[]'::jsonb) INTO v_mailboxes
  FROM (
    SELECT jsonb_build_object(
      'mailbox', m.address,
      'enabled', coalesce(m.sync_enabled, false),
      'last_status', r.status,
      'last_finished', r.finished_at,
      'last_error', left(coalesce(r.error_message, ''), 300)
    ) AS x
    FROM public.email_mailboxes m
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.finished_at, sr.error_message
      FROM public.email_sync_runs sr
      WHERE sr.mailbox_id = m.id
      ORDER BY sr.created_at DESC
      LIMIT 1
    ) r ON true
  ) s;

  SELECT count(*)::int INTO v_xero_failures FROM public.xero_sync_log
  WHERE created_at > now() - interval '24 hours' AND lower(coalesce(status,'')) IN ('error','failed');

  SELECT count(*)::int INTO v_crm_failures FROM public.crm_automation_runs
  WHERE created_at > now() - interval '24 hours' AND success IS FALSE;

  SELECT count(*)::int INTO v_marketing_failures FROM public.marketing_automation_log
  WHERE created_at > now() - interval '24 hours' AND success IS FALSE;

  SELECT count(*)::int INTO v_email_failures FROM public.email_logs
  WHERE created_at > now() - interval '24 hours' AND error_message IS NOT NULL;

  SELECT count(*)::int INTO v_problems
  FROM jsonb_array_elements(v_jobs) e
  WHERE (e->>'failures_24h')::int > 0;

  v_problems := v_problems
    + CASE WHEN v_backup_hours IS NULL OR v_backup_hours > 36 THEN 1 ELSE 0 END
    + CASE WHEN v_xero_failures > 0 THEN 1 ELSE 0 END
    + CASE WHEN v_crm_failures > 0 THEN 1 ELSE 0 END
    + CASE WHEN v_marketing_failures > 0 THEN 1 ELSE 0 END
    + CASE WHEN v_email_failures > 0 THEN 1 ELSE 0 END
    + (SELECT count(*)::int FROM jsonb_array_elements(v_mailboxes) e
       WHERE (e->>'enabled')::boolean
         AND lower(coalesce(e->>'last_status','')) NOT IN ('success','completed','ok','running','in_progress',''));

  RETURN jsonb_build_object(
    'generated_at', now(),
    'problem_count', v_problems,
    'jobs', v_jobs,
    'recent_http_failures', v_http,
    'backup', jsonb_build_object(
      'last_run', v_backup,
      'hours_since_success', v_backup_hours,
      'stale_after_hours', 36
    ),
    'mailboxes', v_mailboxes,
    'failures_24h', jsonb_build_object(
      'xero_sync', v_xero_failures,
      'crm_automation', v_crm_failures,
      'marketing_automation', v_marketing_failures,
      'emails', v_email_failures
    )
  );
END;
$function$;