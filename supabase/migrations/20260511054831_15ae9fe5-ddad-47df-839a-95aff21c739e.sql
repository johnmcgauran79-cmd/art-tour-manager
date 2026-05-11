
-- Operations documents table for Working Documents and Policies & Procedures tabs
CREATE TABLE public.operations_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('working_docs', 'policies')),
  department public.department NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  note TEXT,
  file_path TEXT,           -- storage path in operations-documents bucket
  file_name TEXT,           -- original filename for display
  external_url TEXT,        -- URL alternative to file upload
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT operations_documents_has_source CHECK (file_path IS NOT NULL OR external_url IS NOT NULL)
);

CREATE INDEX idx_operations_documents_category_department
  ON public.operations_documents (category, department);

ALTER TABLE public.operations_documents ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can view
CREATE POLICY "Admin/Manager can view operations documents"
  ON public.operations_documents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert operations documents"
  ON public.operations_documents FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update operations documents"
  ON public.operations_documents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can delete operations documents"
  ON public.operations_documents FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_operations_documents_updated_at
  BEFORE UPDATE ON public.operations_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public)
VALUES ('operations-documents', 'operations-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: admin/manager only
CREATE POLICY "Admin/Manager can read operations-documents files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'operations-documents'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admin/Manager can upload operations-documents files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'operations-documents'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admin/Manager can update operations-documents files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'operations-documents'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admin/Manager can delete operations-documents files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'operations-documents'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );
