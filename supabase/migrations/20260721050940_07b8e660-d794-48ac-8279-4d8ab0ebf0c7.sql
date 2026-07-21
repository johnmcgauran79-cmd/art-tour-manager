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
       AND cfg.poster_user_id IS NOT NULL
       AND NEW.status::text = ANY(cfg.notify_statuses)
       AND (
         cfg.chat_id IS NOT NULL
         OR (cfg.team_id IS NOT NULL AND cfg.channel_id IS NOT NULL)
       ) THEN
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