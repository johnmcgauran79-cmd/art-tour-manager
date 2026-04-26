CREATE TABLE public.hotel_external_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hotel_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hotel external links"
ON public.hotel_external_links
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create hotel external links"
ON public.hotel_external_links
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own hotel external links"
ON public.hotel_external_links
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own hotel external links"
ON public.hotel_external_links
FOR DELETE
USING (auth.uid() = created_by);

CREATE TRIGGER update_hotel_external_links_updated_at
BEFORE UPDATE ON public.hotel_external_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hotel_external_links_hotel_id ON public.hotel_external_links(hotel_id);