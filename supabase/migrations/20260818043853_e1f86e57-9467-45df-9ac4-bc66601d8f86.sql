CREATE TABLE public.tour_inclusion_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('inclusion','exclusion')),
  content_html TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_inclusion_items TO authenticated;
GRANT ALL ON public.tour_inclusion_items TO service_role;

ALTER TABLE public.tour_inclusion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view tour inclusion items"
ON public.tour_inclusion_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Write roles can manage tour inclusion items"
ON public.tour_inclusion_items FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'booking_agent')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'booking_agent')
);

CREATE INDEX idx_tour_inclusion_items_tour ON public.tour_inclusion_items(tour_id, kind, sort_order);

CREATE TRIGGER update_tour_inclusion_items_updated_at
BEFORE UPDATE ON public.tour_inclusion_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS website_description TEXT;