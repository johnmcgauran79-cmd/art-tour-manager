CREATE TABLE IF NOT EXISTS public.xero_api_locks (
  lock_name TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

GRANT ALL ON public.xero_api_locks TO service_role;

ALTER TABLE public.xero_api_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages xero locks"
  ON public.xero_api_locks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.try_acquire_xero_lock(
  _lock_name TEXT,
  _holder TEXT,
  _ttl_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now TIMESTAMPTZ := now();
  _new_expiry TIMESTAMPTZ := _now + make_interval(secs => _ttl_seconds);
BEGIN
  INSERT INTO public.xero_api_locks (lock_name, holder, acquired_at, expires_at)
  VALUES (_lock_name, _holder, _now, _new_expiry)
  ON CONFLICT (lock_name) DO UPDATE
    SET holder = EXCLUDED.holder,
        acquired_at = EXCLUDED.acquired_at,
        expires_at = EXCLUDED.expires_at
    WHERE public.xero_api_locks.expires_at < _now
       OR public.xero_api_locks.holder = EXCLUDED.holder;

  RETURN EXISTS (
    SELECT 1 FROM public.xero_api_locks
    WHERE lock_name = _lock_name
      AND holder = _holder
      AND expires_at = _new_expiry
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_xero_lock(
  _lock_name TEXT,
  _holder TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.xero_api_locks
  WHERE lock_name = _lock_name AND holder = _holder;
END;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_xero_lock(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_xero_lock(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_xero_lock(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_xero_lock(TEXT, TEXT) TO service_role;