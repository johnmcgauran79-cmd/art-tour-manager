
-- ============================================================
-- ART AI Phase 1 — platform foundation
-- ============================================================

-- Reused timestamp trigger (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Retention default (configurable; changing it does NOT retro-shorten existing conversations)
INSERT INTO public.general_settings (setting_key, setting_value, description)
VALUES ('ai_conversation_retention_days', '180'::jsonb, 'Default number of days an ART AI conversation is retained before automatic purge.')
ON CONFLICT (setting_key) DO NOTHING;

-- Helper: current retention days from general_settings (falls back to 180)
CREATE OR REPLACE FUNCTION public.ai_retention_days()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(regexp_replace((setting_value#>>'{}'), '[^0-9]', '', 'g'), '')::int,
    180
  )
  FROM public.general_settings
  WHERE setting_key = 'ai_conversation_retention_days'
  LIMIT 1;
$$;

-- ============================================================
-- ai_conversations
-- ============================================================
CREATE TABLE public.ai_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_prompt_version text NOT NULL DEFAULT 'art-ai-v1',
  retain_indefinitely boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + (COALESCE(public.ai_retention_days(), 180) || ' days')::interval),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own conversations"
ON public.ai_conversations FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations (user_id, updated_at DESC);
CREATE INDEX idx_ai_conversations_purge ON public.ai_conversations (expires_at, deleted_at);

CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ai_messages
-- ============================================================
CREATE TABLE public.ai_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own messages"
ON public.ai_messages FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert messages into their own conversations"
ON public.ai_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users delete their own messages"
ON public.ai_messages FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_ai_messages_conversation ON public.ai_messages (conversation_id, created_at);

-- Refresh conversation expiry + updated_at on new activity (respecting current setting)
CREATE OR REPLACE FUNCTION public.ai_touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET updated_at = now(),
      expires_at = now() + (COALESCE(public.ai_retention_days(), 180) || ' days')::interval
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_touch_conversation
AFTER INSERT ON public.ai_messages
FOR EACH ROW EXECUTE FUNCTION public.ai_touch_conversation_on_message();

-- ============================================================
-- ai_usage
-- ============================================================
CREATE TABLE public.ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  tool_call_count integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own usage"
ON public.ai_usage FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Ordinary per-turn inserts use the user-token client; RLS enforces that the
-- conversation AND message both belong to the authenticated user.
CREATE POLICY "Users insert usage for their own conversation and message"
ON public.ai_usage FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  )
  AND (
    message_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.ai_messages m
      WHERE m.id = message_id AND m.conversation_id = ai_usage.conversation_id AND m.user_id = auth.uid()
    )
  )
);

CREATE INDEX idx_ai_usage_user ON public.ai_usage (user_id, created_at DESC);

-- ============================================================
-- ai_rate_limits (durable, DB-backed sliding window)
-- ============================================================
CREATE TABLE public.ai_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now()
);

-- No content stored, only timestamps. Managed exclusively by the trusted RPC / server.
GRANT ALL ON public.ai_rate_limits TO service_role;

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: only the SECURITY DEFINER RPC and service_role touch this table.

CREATE INDEX idx_ai_rate_limits_user_time ON public.ai_rate_limits (user_id, requested_at);

-- Atomic rate-limit check. Returns jsonb { allowed, remaining, retry_after_seconds, limit }.
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id uuid,
  _max_requests integer DEFAULT 20,
  _window_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz := now() - make_interval(secs => _window_seconds);
  _count integer;
  _oldest timestamptz;
  _retry integer;
BEGIN
  -- Serialize concurrent checks for the same user to prevent bypass.
  PERFORM pg_advisory_xact_lock(hashtext('ai_rate_limit:' || _user_id::text));

  -- Cleanup expired counters for this user.
  DELETE FROM public.ai_rate_limits
  WHERE user_id = _user_id AND requested_at < _window_start;

  SELECT count(*), min(requested_at) INTO _count, _oldest
  FROM public.ai_rate_limits
  WHERE user_id = _user_id AND requested_at >= _window_start;

  IF _count >= _max_requests THEN
    _retry := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_oldest + make_interval(secs => _window_seconds) - now())))::int);
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', _retry,
      'limit', _max_requests
    );
  END IF;

  INSERT INTO public.ai_rate_limits (user_id) VALUES (_user_id);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', _max_requests - _count - 1,
    'retry_after_seconds', 0,
    'limit', _max_requests
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(uuid, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, integer, integer) TO service_role;

-- ============================================================
-- Daily permanent purge (trusted / service-role only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_ai_conversations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  WITH removed AS (
    DELETE FROM public.ai_conversations
    WHERE
      (deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days')
      OR (expires_at < now() AND retain_indefinitely = false)
    RETURNING id
  )
  SELECT count(*) INTO _deleted FROM removed;

  -- Housekeeping: drop stale rate-limit rows (older than 1 day).
  DELETE FROM public.ai_rate_limits WHERE requested_at < now() - interval '1 day';

  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_ai_conversations() FROM public;
GRANT EXECUTE ON FUNCTION public.purge_ai_conversations() TO service_role;
