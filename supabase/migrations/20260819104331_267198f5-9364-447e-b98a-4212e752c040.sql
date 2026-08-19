CREATE OR REPLACE FUNCTION public.record_website_change(
  _tour_id uuid,
  _section text,
  _summary text,
  _before jsonb,
  _after jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _request_id uuid;
  _is_new boolean := false;
  _section_label text;
  _tour_name text;
  _actor uuid := auth.uid();
  cfg RECORD;
BEGIN
  IF _tour_id IS NULL THEN RETURN; END IF;

  SELECT id INTO _request_id
  FROM public.website_change_requests
  WHERE tour_id = _tour_id AND section = _section AND status = 'pending'
  LIMIT 1;

  IF _request_id IS NULL THEN
    INSERT INTO public.website_change_requests (tour_id, section, last_changed_by)
    VALUES (_tour_id, _section, _actor)
    RETURNING id INTO _request_id;
    _is_new := true;
  ELSE
    UPDATE public.website_change_requests
    SET change_count = change_count + 1,
        last_changed_at = now(),
        last_changed_by = COALESCE(_actor, last_changed_by)
    WHERE id = _request_id;
  END IF;

  INSERT INTO public.website_change_events (request_id, tour_id, section, summary, before_value, after_value, changed_by)
  VALUES (_request_id, _tour_id, _section, _summary, _before, _after, _actor);

  IF _is_new THEN
    _section_label := CASE _section
      WHEN 'description' THEN 'website description'
      WHEN 'inclusions' THEN 'inclusions'
      WHEN 'exclusions' THEN 'exclusions'
      WHEN 'itinerary' THEN 'itinerary'
      WHEN 'itinerary_photos' THEN 'itinerary photos'
      ELSE _section
    END;

    SELECT name INTO _tour_name FROM public.tours WHERE id = _tour_id;

    IF _actor IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, type, priority, title, message, related_id)
      VALUES (
        _actor,
        'website_change_submitted',
        'low',
        'Sent for approval',
        'Your requested ' || _section_label || ' changes for ' || COALESCE(_tour_name, 'this tour') ||
          ' have been sent for approval and publishing.',
        _tour_id
      );
    END IF;

    SELECT * INTO cfg FROM public.teams_channel_notify_config WHERE id = true;
    IF cfg.enabled
       AND cfg.poster_user_id IS NOT NULL
       AND (cfg.chat_id IS NOT NULL OR (cfg.team_id IS NOT NULL AND cfg.channel_id IS NOT NULL)) THEN
      PERFORM net.http_post(
        url := 'https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/notify-website-change-teams',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcXZndHV4ZnpzcndqYWhrbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTg3OTIsImV4cCI6MjA2NTA5NDc5Mn0.2XXCeilTJt-_0UdN_TCiT3Zyie_ci9Iwx6F7ZTsH0XQ"}'::jsonb,
        body := jsonb_build_object(
          'tour_id', _tour_id,
          'tour_name', COALESCE(_tour_name, 'Tour'),
          'section', _section,
          'section_label', _section_label,
          'request_id', _request_id,
          'changed_by', _actor
        )
      );
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_website_change(uuid, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_website_change(uuid, text, text, jsonb, jsonb) FROM anon;