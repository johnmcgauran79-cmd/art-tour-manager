-- Brands / themes for multi-brand support
CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  legal_name text,
  short_name text,
  logo_url text,
  email_header_image_url text,
  color_primary text NOT NULL DEFAULT '#0a1929',
  color_border text NOT NULL DEFAULT '#0a1929',
  color_button text NOT NULL DEFAULT '#0a1929',
  color_button_text text NOT NULL DEFAULT '#d4a017',
  color_accent text NOT NULL DEFAULT '#d4a017',
  sender_name text NOT NULL DEFAULT 'Australian Racing Tours',
  from_email_client text,
  from_email_operational text,
  company_address text,
  company_phone text,
  company_website text,
  footer_text text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Everyone (incl. public token pages) can read brands for display
CREATE POLICY "Anyone can view brands" ON public.brands
  FOR SELECT USING (true);

-- Only admins can manage brands
CREATE POLICY "Admins can insert brands" ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update brands" ON public.brands
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete brands" ON public.brands
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger (reuse existing function)
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce a single default brand
CREATE OR REPLACE FUNCTION public.enforce_single_default_brand()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.brands SET is_default = false WHERE id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_default_brand_trg
  AFTER INSERT OR UPDATE OF is_default ON public.brands
  FOR EACH ROW WHEN (NEW.is_default)
  EXECUTE FUNCTION public.enforce_single_default_brand();

-- Seed the default brand from existing general_settings values
INSERT INTO public.brands (
  name, legal_name, short_name, email_header_image_url, logo_url,
  color_primary, color_border, color_button, color_button_text, color_accent,
  sender_name, from_email_client, from_email_operational,
  company_website, is_default, is_active, sort_order
)
SELECT
  'Australian Racing Tours',
  'Australian Racing Tours',
  'ART',
  (SELECT setting_value::text FROM public.general_settings WHERE setting_key = 'email_header_image_url'),
  (SELECT setting_value::text FROM public.general_settings WHERE setting_key = 'email_header_image_url'),
  '#0a1929', '#0a1929', '#0a1929', '#d4a017', '#d4a017',
  COALESCE((SELECT setting_value::text FROM public.general_settings WHERE setting_key = 'default_sender_name'), 'Australian Racing Tours'),
  COALESCE((SELECT setting_value::text FROM public.general_settings WHERE setting_key = 'default_from_email_client'), 'bookings@australianracingtours.com.au'),
  COALESCE((SELECT setting_value::text FROM public.general_settings WHERE setting_key = 'default_from_email_internal'), 'admin@australianracingtours.com.au'),
  'australianracingtours.com.au',
  true, true, 0;

-- Add brand_id to tours and backfill to default brand
ALTER TABLE public.tours ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

UPDATE public.tours SET brand_id = (SELECT id FROM public.brands WHERE is_default LIMIT 1);