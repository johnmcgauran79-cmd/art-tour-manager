
CREATE TABLE public.wordpress_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_field_key TEXT NOT NULL UNIQUE,
  wp_group TEXT NOT NULL DEFAULT 'headline',
  wp_label TEXT,
  wp_kind TEXT NOT NULL DEFAULT 'text',
  art_source TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wordpress_field_mappings TO authenticated;
GRANT ALL ON public.wordpress_field_mappings TO service_role;

ALTER TABLE public.wordpress_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wp_field_mappings admin/manager select"
  ON public.wordpress_field_mappings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "wp_field_mappings admin/manager insert"
  ON public.wordpress_field_mappings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "wp_field_mappings admin/manager update"
  ON public.wordpress_field_mappings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "wp_field_mappings admin/manager delete"
  ON public.wordpress_field_mappings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_wp_field_mappings_updated_at
  BEFORE UPDATE ON public.wordpress_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults from the existing hardcoded TOUR_FIELD_MAP
INSERT INTO public.wordpress_field_mappings (wp_field_key, wp_group, wp_label, wp_kind, art_source) VALUES
  ('single_room_price',            'headline', 'Single room price',      'number', 'tours.price_single'),
  ('twin_room_per_person_price',   'headline', 'Twin room (per person)', 'number', 'tours.price_twin'),
  ('double_room_per_person_price', 'headline', 'Double room (per person)','number','tours.price_double'),
  ('start_date',                   'headline', 'Start date',             'date',   'tours.start_date'),
  ('end_date',                     'headline', 'End date',               'date',   'tours.end_date'),
  ('location',                     'headline', 'Location',               'text',   'tours.location'),
  ('capacity',                     'headline', 'Capacity',               'number', 'tours.capacity'),
  ('payment_details',              'headline', 'Payment details',        'html',   'tours.instalment_details')
ON CONFLICT (wp_field_key) DO NOTHING;
