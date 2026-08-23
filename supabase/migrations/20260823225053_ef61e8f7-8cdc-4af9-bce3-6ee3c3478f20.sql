CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  category text,
  color text NOT NULL DEFAULT '#64748b',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tags_slug_key ON public.tags (slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view tags" ON public.tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update tags" ON public.tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete tags" ON public.tags FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contact_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tag_id)
);
CREATE INDEX contact_tags_customer_idx ON public.contact_tags (customer_id);
CREATE INDEX contact_tags_tag_idx ON public.contact_tags (tag_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_tags TO authenticated;
GRANT ALL ON public.contact_tags TO service_role;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view contact tags" ON public.contact_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert contact tags" ON public.contact_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can delete contact tags" ON public.contact_tags FOR DELETE TO authenticated USING (true);

CREATE TABLE public.booking_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, tag_id)
);
CREATE INDEX booking_tags_booking_idx ON public.booking_tags (booking_id);
CREATE INDEX booking_tags_tag_idx ON public.booking_tags (tag_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_tags TO authenticated;
GRANT ALL ON public.booking_tags TO service_role;
ALTER TABLE public.booking_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view booking tags" ON public.booking_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert booking tags" ON public.booking_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can delete booking tags" ON public.booking_tags FOR DELETE TO authenticated USING (true);