-- Ignore pg_net client-side timeout rows when counting background call failures.
-- The cron job's HTTP request still ran; pg_net simply stopped waiting after 5s.
CREATE OR REPLACE FUNCTION public.get_system_health_service()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH job_fail AS (
    SELECT r.jobid, count(*)::int AS cnt, max(r.return_message) AS msg
    FROM cron.job_run_details r
    WHERE r.start_time > now() - interval '24 hours' AND r.status <> 'succeeded'
    GROUP BY r.jobid
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'stale_backup_hours', (SELECT (extract(epoch FROM (now() - max(finished_at)))/3600)::numeric(10,1) FROM public.backup_runs WHERE status='success' AND kind IN ('database', 'full')),
    'stale_storage_backup_hours', (SELECT (extract(epoch FROM (now() - max(finished_at)))/3600)::numeric(10,1) FROM public.backup_runs WHERE status='success' AND kind IN ('storage','full')),
    'stale_code_backup_hours', (SELECT (extract(epoch FROM (now() - max(finished_at)))/3600)::numeric(10,1) FROM public.backup_runs WHERE status='success' AND kind = 'code'),
    'failed_jobs_24h', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('jobname', j.jobname, 'failures', f.cnt, 'message', left(coalesce(f.msg,''),300))), '[]'::jsonb)
      FROM job_fail f JOIN cron.job j ON j.jobid = f.jobid
    ),
    'http_failures_24h', (
      SELECT count(*)::int FROM net._http_response
      WHERE created > now() - interval '24 hours'
        AND status_code >= 400
    ),
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
$fn$;