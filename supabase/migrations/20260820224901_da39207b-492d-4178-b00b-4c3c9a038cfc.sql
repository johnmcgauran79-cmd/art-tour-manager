ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS website_link_status text NOT NULL DEFAULT 'unlinked';

ALTER TABLE public.tours
  DROP CONSTRAINT IF EXISTS tours_website_link_status_check;

ALTER TABLE public.tours
  ADD CONSTRAINT tours_website_link_status_check
  CHECK (website_link_status IN ('unlinked', 'linked', 'no_website_tour'));

UPDATE public.tours t
SET website_link_status = 'linked'
WHERE EXISTS (
  SELECT 1 FROM public.wordpress_tour_links l WHERE l.tour_id = t.id
) AND t.website_link_status <> 'linked';