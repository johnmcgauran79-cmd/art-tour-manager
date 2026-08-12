ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_brand_id ON public.bookings(brand_id);

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS partnership_note text;