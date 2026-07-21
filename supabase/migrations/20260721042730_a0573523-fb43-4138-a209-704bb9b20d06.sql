-- Teams channel notification config for tour status changes
CREATE TABLE IF NOT EXISTS public.teams_channel_notify_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT false,
  team_id text,
  channel_id text,
  team_name text,
  channel_name text,
  poster_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notify_statuses text[] NOT NULL DEFAULT ARRAY['limited_availability','sold_out'],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams_channel_notify_config TO authenticated;
GRANT ALL ON public.teams_channel_notify_config TO service_role;

ALTER TABLE public.teams_channel_notify_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage teams channel notify config"
  ON public.teams_channel_notify_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.teams_channel_notify_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Trigger on tour status change: notify Teams channel
CREATE OR REPLACE FUNCTION public.notify_teams_on_tour_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg RECORD;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT * INTO cfg FROM public.teams_channel_notify_config WHERE id = true;
    IF cfg.enabled
       AND cfg.team_id IS NOT NULL
       AND cfg.channel_id IS NOT NULL
       AND cfg.poster_user_id IS NOT NULL
       AND NEW.status = ANY(cfg.notify_statuses) THEN
      PERFORM net.http_post(
        url := 'https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/notify-tour-status-teams',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcXZndHV4ZnpzcndqYWhrbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTg3OTIsImV4cCI6MjA2NTA5NDc5Mn0.2XXCeilTJt-_0UdN_TCiT3Zyie_ci9Iwx6F7ZTsH0XQ"}'::jsonb,
        body := jsonb_build_object(
          'tour_id', NEW.id,
          'tour_name', NEW.name,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_teams_on_tour_status_change ON public.tours;
CREATE TRIGGER trg_notify_teams_on_tour_status_change
  AFTER UPDATE OF status ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_teams_on_tour_status_change();