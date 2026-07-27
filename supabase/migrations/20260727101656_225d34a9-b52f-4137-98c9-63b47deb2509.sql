
CREATE TABLE public.wordpress_tour_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  wp_tour_id integer NOT NULL,
  wp_slug text,
  wp_title_snapshot text,
  linked_by uuid REFERENCES auth.users(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  last_wp_modified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tour_id),
  UNIQUE (wp_tour_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wordpress_tour_links TO authenticated;
GRANT ALL ON public.wordpress_tour_links TO service_role;

ALTER TABLE public.wordpress_tour_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager can view wordpress_tour_links"
  ON public.wordpress_tour_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/manager can insert wordpress_tour_links"
  ON public.wordpress_tour_links FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/manager can update wordpress_tour_links"
  ON public.wordpress_tour_links FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/manager can delete wordpress_tour_links"
  ON public.wordpress_tour_links FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_wordpress_tour_links_updated_at
  BEFORE UPDATE ON public.wordpress_tour_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wordpress_tour_links_tour_id ON public.wordpress_tour_links(tour_id);
CREATE INDEX idx_wordpress_tour_links_wp_tour_id ON public.wordpress_tour_links(wp_tour_id);
