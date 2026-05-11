-- Sections per category for Operations Documents
CREATE TABLE public.operations_document_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('working_docs','policies')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category, name)
);

CREATE INDEX idx_ops_doc_sections_cat_order ON public.operations_document_sections(category, sort_order);

ALTER TABLE public.operations_document_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager view ops doc sections"
ON public.operations_document_sections FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager insert ops doc sections"
ON public.operations_document_sections FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager update ops doc sections"
ON public.operations_document_sections FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager delete ops doc sections"
ON public.operations_document_sections FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_ops_doc_sections_updated
BEFORE UPDATE ON public.operations_document_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with the existing departments for both categories
INSERT INTO public.operations_document_sections (category, name, sort_order) VALUES
  ('working_docs','Operations',10),
  ('working_docs','Finance',20),
  ('working_docs','Marketing',30),
  ('working_docs','Booking',40),
  ('working_docs','Maintenance',50),
  ('working_docs','General',60),
  ('policies','Operations',10),
  ('policies','Finance',20),
  ('policies','Marketing',30),
  ('policies','Booking',40),
  ('policies','Maintenance',50),
  ('policies','General',60);

-- Relax the operations_documents.department column so it can hold any section name (free text)
-- Existing values remain valid since they match the seeded section names.
-- If department was an enum, we need to convert it to TEXT.
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='operations_documents' AND column_name='department';
  IF col_type <> 'text' THEN
    ALTER TABLE public.operations_documents ALTER COLUMN department TYPE TEXT USING department::text;
  END IF;
END $$;