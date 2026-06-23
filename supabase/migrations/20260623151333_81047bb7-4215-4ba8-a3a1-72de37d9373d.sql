CREATE TABLE public.tour_document_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  caption TEXT,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_document_images TO authenticated;
GRANT ALL ON public.tour_document_images TO service_role;

ALTER TABLE public.tour_document_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view tour document images"
ON public.tour_document_images FOR SELECT TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR
  check_user_role(auth.uid(), 'manager') OR
  check_user_role(auth.uid(), 'booking_agent')
);

CREATE POLICY "Managers can insert tour document images"
ON public.tour_document_images FOR INSERT TO authenticated
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager')
);

CREATE POLICY "Managers can update tour document images"
ON public.tour_document_images FOR UPDATE TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager')
)
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager')
);

CREATE POLICY "Managers can delete tour document images"
ON public.tour_document_images FOR DELETE TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager')
);

CREATE TRIGGER update_tour_document_images_updated_at
BEFORE UPDATE ON public.tour_document_images
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();