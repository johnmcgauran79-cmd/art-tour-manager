CREATE TABLE public.backup_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'github-actions',
  kind text NOT NULL DEFAULT 'database',
  status text NOT NULL DEFAULT 'success',
  started_at timestamptz,
  finished_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  size_bytes bigint,
  destination text,
  artifact_name text,
  tables_count integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_runs_finished_at ON public.backup_runs (finished_at DESC);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view backup runs"
ON public.backup_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));