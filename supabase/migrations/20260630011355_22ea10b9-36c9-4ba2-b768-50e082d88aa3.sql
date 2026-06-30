CREATE TABLE public.activity_external_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_external_links TO authenticated;
GRANT ALL ON public.activity_external_links TO service_role;

ALTER TABLE public.activity_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity external links"
  ON public.activity_external_links FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create activity external links"
  ON public.activity_external_links FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own activity external links"
  ON public.activity_external_links FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own activity external links"
  ON public.activity_external_links FOR DELETE
  USING (auth.uid() = created_by);

CREATE TRIGGER update_activity_external_links_updated_at
  BEFORE UPDATE ON public.activity_external_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();