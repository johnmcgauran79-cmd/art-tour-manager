CREATE TABLE public.website_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('description','inclusions','exclusions','itinerary','itinerary_photos')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  change_count integer NOT NULL DEFAULT 1,
  last_changed_by uuid,
  first_changed_at timestamptz NOT NULL DEFAULT now(),
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX website_change_requests_pending_unique
  ON public.website_change_requests (tour_id, section)
  WHERE status = 'pending';
CREATE INDEX website_change_requests_status_idx ON public.website_change_requests (status, last_changed_at DESC);

CREATE TABLE public.website_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.website_change_requests(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL,
  section text NOT NULL,
  summary text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX website_change_events_request_idx ON public.website_change_events (request_id, changed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_change_requests TO authenticated;
GRANT ALL ON public.website_change_requests TO service_role;
GRANT SELECT ON public.website_change_events TO authenticated;
GRANT ALL ON public.website_change_events TO service_role;

ALTER TABLE public.website_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_change_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_website_approver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_departments ud
        WHERE ud.user_id = _user_id AND ud.department = 'marketing'::department
      );
$$;

CREATE POLICY "Staff can view website change requests"
  ON public.website_change_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Approvers can update website change requests"
  ON public.website_change_requests FOR UPDATE TO authenticated
  USING (public.is_website_approver(auth.uid()))
  WITH CHECK (public.is_website_approver(auth.uid()));
CREATE POLICY "Approvers can delete website change requests"
  ON public.website_change_requests FOR DELETE TO authenticated
  USING (public.is_website_approver(auth.uid()));

CREATE POLICY "Staff can view website change events"
  ON public.website_change_events FOR SELECT TO authenticated USING (true);

CREATE TRIGGER website_change_requests_updated_at
  BEFORE UPDATE ON public.website_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_website_change(
  _tour_id uuid,
  _section text,
  _summary text,
  _before jsonb,
  _after jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request_id uuid;
BEGIN
  IF _tour_id IS NULL THEN RETURN; END IF;

  SELECT id INTO _request_id
  FROM public.website_change_requests
  WHERE tour_id = _tour_id AND section = _section AND status = 'pending'
  LIMIT 1;

  IF _request_id IS NULL THEN
    INSERT INTO public.website_change_requests (tour_id, section, last_changed_by)
    VALUES (_tour_id, _section, auth.uid())
    RETURNING id INTO _request_id;
  ELSE
    UPDATE public.website_change_requests
    SET change_count = change_count + 1,
        last_changed_at = now(),
        last_changed_by = COALESCE(auth.uid(), last_changed_by)
    WHERE id = _request_id;
  END IF;

  INSERT INTO public.website_change_events (request_id, tour_id, section, summary, before_value, after_value, changed_by)
  VALUES (_request_id, _tour_id, _section, _summary, _before, _after, auth.uid());
END;
$$;

-- Website description on tours
CREATE OR REPLACE FUNCTION public.track_website_description_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.website_description, '') IS DISTINCT FROM COALESCE(NEW.website_description, '') THEN
    PERFORM public.record_website_change(
      NEW.id, 'description', 'Website description updated',
      to_jsonb(OLD.website_description), to_jsonb(NEW.website_description));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_website_description
  AFTER UPDATE OF website_description ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.track_website_description_change();

-- Inclusions / exclusions
CREATE OR REPLACE FUNCTION public.track_inclusion_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _section text;
BEGIN
  _rec := COALESCE(NEW, OLD);
  _section := CASE WHEN _rec.kind = 'exclusion' THEN 'exclusions' ELSE 'inclusions' END;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_website_change(_rec.tour_id, _section, 'Item added', NULL, to_jsonb(NEW.content_html));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.record_website_change(_rec.tour_id, _section, 'Item removed', to_jsonb(OLD.content_html), NULL);
  ELSE
    IF COALESCE(OLD.content_html,'') IS DISTINCT FROM COALESCE(NEW.content_html,'') THEN
      PERFORM public.record_website_change(_rec.tour_id, _section, 'Item edited', to_jsonb(OLD.content_html), to_jsonb(NEW.content_html));
    ELSIF COALESCE(OLD.sort_order,0) IS DISTINCT FROM COALESCE(NEW.sort_order,0) THEN
      PERFORM public.record_website_change(_rec.tour_id, _section, 'Items reordered', to_jsonb(OLD.sort_order), to_jsonb(NEW.sort_order));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_track_inclusion_items
  AFTER INSERT OR UPDATE OR DELETE ON public.tour_inclusion_items
  FOR EACH ROW EXECUTE FUNCTION public.track_inclusion_item_change();

-- Itinerary entries (day text)
CREATE OR REPLACE FUNCTION public.track_itinerary_entry_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _tour_id uuid;
  _summary text;
BEGIN
  _rec := COALESCE(NEW, OLD);

  SELECT ti.tour_id INTO _tour_id
  FROM public.tour_itinerary_days d
  JOIN public.tour_itineraries ti ON ti.id = d.itinerary_id
  WHERE d.id = _rec.day_id;

  IF _tour_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    _summary := 'Itinerary entry added: ' || COALESCE(NEW.subject, '');
    PERFORM public.record_website_change(_tour_id, 'itinerary', _summary, NULL, to_jsonb(NEW.content));
  ELSIF TG_OP = 'DELETE' THEN
    _summary := 'Itinerary entry removed: ' || COALESCE(OLD.subject, '');
    PERFORM public.record_website_change(_tour_id, 'itinerary', _summary, to_jsonb(OLD.content), NULL);
  ELSE
    IF COALESCE(OLD.subject,'') IS DISTINCT FROM COALESCE(NEW.subject,'')
       OR COALESCE(OLD.content,'') IS DISTINCT FROM COALESCE(NEW.content,'')
       OR COALESCE(OLD.sort_order,0) IS DISTINCT FROM COALESCE(NEW.sort_order,0) THEN
      _summary := 'Itinerary entry edited: ' || COALESCE(NEW.subject, '');
      PERFORM public.record_website_change(_tour_id, 'itinerary', _summary,
        jsonb_build_object('subject', OLD.subject, 'content', OLD.content),
        jsonb_build_object('subject', NEW.subject, 'content', NEW.content));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_track_itinerary_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.tour_itinerary_entries
  FOR EACH ROW EXECUTE FUNCTION public.track_itinerary_entry_change();

-- Itinerary days (added / removed / dates)
CREATE OR REPLACE FUNCTION public.track_itinerary_day_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _tour_id uuid;
BEGIN
  _rec := COALESCE(NEW, OLD);
  SELECT ti.tour_id INTO _tour_id FROM public.tour_itineraries ti WHERE ti.id = _rec.itinerary_id;
  IF _tour_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_website_change(_tour_id, 'itinerary', 'Itinerary day ' || NEW.day_number || ' added', NULL, to_jsonb(NEW.activity_date));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.record_website_change(_tour_id, 'itinerary', 'Itinerary day ' || OLD.day_number || ' removed', to_jsonb(OLD.activity_date), NULL);
  ELSIF OLD.activity_date IS DISTINCT FROM NEW.activity_date OR OLD.day_number IS DISTINCT FROM NEW.day_number THEN
    PERFORM public.record_website_change(_tour_id, 'itinerary', 'Itinerary day ' || NEW.day_number || ' date changed', to_jsonb(OLD.activity_date), to_jsonb(NEW.activity_date));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_track_itinerary_days
  AFTER INSERT OR UPDATE OR DELETE ON public.tour_itinerary_days
  FOR EACH ROW EXECUTE FUNCTION public.track_itinerary_day_change();

-- Itinerary day photos
CREATE OR REPLACE FUNCTION public.track_itinerary_day_image_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _tour_id uuid;
BEGIN
  _rec := COALESCE(NEW, OLD);
  SELECT ti.tour_id INTO _tour_id
  FROM public.tour_itinerary_days d
  JOIN public.tour_itineraries ti ON ti.id = d.itinerary_id
  WHERE d.id = _rec.day_id;
  IF _tour_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_website_change(_tour_id, 'itinerary_photos', 'Photo added: ' || COALESCE(NEW.file_name, ''), NULL, to_jsonb(NEW.file_path));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.record_website_change(_tour_id, 'itinerary_photos', 'Photo removed: ' || COALESCE(OLD.file_name, ''), to_jsonb(OLD.file_path), NULL);
  ELSIF COALESCE(OLD.caption,'') IS DISTINCT FROM COALESCE(NEW.caption,'')
        OR COALESCE(OLD.sort_order,0) IS DISTINCT FROM COALESCE(NEW.sort_order,0) THEN
    PERFORM public.record_website_change(_tour_id, 'itinerary_photos', 'Photo details updated', to_jsonb(OLD.caption), to_jsonb(NEW.caption));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_track_itinerary_day_images
  AFTER INSERT OR UPDATE OR DELETE ON public.tour_itinerary_day_images
  FOR EACH ROW EXECUTE FUNCTION public.track_itinerary_day_image_change();

REVOKE EXECUTE ON FUNCTION public.record_website_change(uuid, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_website_approver(uuid) TO authenticated;