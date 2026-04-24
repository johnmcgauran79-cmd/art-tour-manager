-- Per-user Microsoft Teams OAuth connections
CREATE TABLE public.user_teams_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ms_user_id TEXT NOT NULL,
  ms_display_name TEXT,
  ms_user_principal_name TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_teams_connections_user_id ON public.user_teams_connections(user_id);
CREATE INDEX idx_user_teams_connections_ms_user_id ON public.user_teams_connections(ms_user_id);

ALTER TABLE public.user_teams_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own connection
CREATE POLICY "Users can view their own Teams connection"
ON public.user_teams_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own connection (the edge function uses service role, but allow this for completeness)
CREATE POLICY "Users can insert their own Teams connection"
ON public.user_teams_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connection
CREATE POLICY "Users can update their own Teams connection"
ON public.user_teams_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete (disconnect) their own connection
CREATE POLICY "Users can delete their own Teams connection"
ON public.user_teams_connections
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Auto-update updated_at on changes
CREATE TRIGGER update_user_teams_connections_updated_at
BEFORE UPDATE ON public.user_teams_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Short-lived OAuth state tokens to prevent CSRF during the OAuth dance
CREATE TABLE public.teams_oauth_states (
  state TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

CREATE INDEX idx_teams_oauth_states_user_id ON public.teams_oauth_states(user_id);
CREATE INDEX idx_teams_oauth_states_expires_at ON public.teams_oauth_states(expires_at);

ALTER TABLE public.teams_oauth_states ENABLE ROW LEVEL SECURITY;

-- Only the user who created the state can see it (edge functions use service role)
CREATE POLICY "Users can view their own oauth states"
ON public.teams_oauth_states
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);