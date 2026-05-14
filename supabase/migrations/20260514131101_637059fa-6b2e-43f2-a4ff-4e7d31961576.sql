-- Enum for channel choice
DO $$ BEGIN
  CREATE TYPE public.task_notif_channel AS ENUM ('off','email','teams','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_digest_cadence AS ENUM ('daily','weekly','custom_weekdays');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.task_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- channels
  alerts_channel public.task_notif_channel NOT NULL DEFAULT 'email',
  digest_channel public.task_notif_channel NOT NULL DEFAULT 'email',

  -- scope
  scope_assigned boolean NOT NULL DEFAULT true,
  scope_watching boolean NOT NULL DEFAULT false,
  scope_mentioned boolean NOT NULL DEFAULT false,

  -- due-soon alerts
  alerts_enabled boolean NOT NULL DEFAULT true,
  alert_thresholds_hours integer[] NOT NULL DEFAULT ARRAY[24]::integer[],
  alert_on_overdue boolean NOT NULL DEFAULT true,
  overdue_reminder_interval_hours integer NOT NULL DEFAULT 24,
  alert_priority_filter text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- digests
  digest_enabled boolean NOT NULL DEFAULT false,
  digest_cadence public.task_digest_cadence NOT NULL DEFAULT 'daily',
  digest_weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::integer[],
  digest_time_local time NOT NULL DEFAULT '08:00',
  digest_lookahead_days integer NOT NULL DEFAULT 7,
  digest_include_overdue boolean NOT NULL DEFAULT true,
  digest_include_due_today boolean NOT NULL DEFAULT true,
  digest_include_upcoming boolean NOT NULL DEFAULT true,
  digest_include_newly_assigned boolean NOT NULL DEFAULT true,
  digest_include_watched boolean NOT NULL DEFAULT false,
  digest_include_subtasks boolean NOT NULL DEFAULT true,
  digest_skip_if_empty boolean NOT NULL DEFAULT true,
  digest_priority_filter text[] NOT NULL DEFAULT ARRAY[]::text[],
  last_digest_sent_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own task notif prefs" ON public.task_notification_preferences;
CREATE POLICY "Users view own task notif prefs"
  ON public.task_notification_preferences FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Users insert own task notif prefs" ON public.task_notification_preferences;
CREATE POLICY "Users insert own task notif prefs"
  ON public.task_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own task notif prefs" ON public.task_notification_preferences;
CREATE POLICY "Users update own task notif prefs"
  ON public.task_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_task_notif_prefs_updated_at ON public.task_notification_preferences;
CREATE TRIGGER update_task_notif_prefs_updated_at
BEFORE UPDATE ON public.task_notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Send log for dedupe
CREATE TABLE IF NOT EXISTS public.task_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL,
  kind text NOT NULL,                 -- 'due_alert' | 'overdue_reminder' | 'digest'
  threshold_hours integer,            -- for due_alert
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_notif_log_lookup
  ON public.task_notification_log (user_id, task_id, kind, threshold_hours, sent_at DESC);

ALTER TABLE public.task_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own task notif log" ON public.task_notification_log;
CREATE POLICY "Users view own task notif log"
  ON public.task_notification_log FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));