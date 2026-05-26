
-- 1) Table
CREATE TABLE public.email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email attachments"
ON public.email_attachments FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admin/Manager can insert email attachments"
ON public.email_attachments FOR INSERT
TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admin/Manager can update email attachments"
ON public.email_attachments FOR UPDATE
TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admin/Manager can delete email attachments"
ON public.email_attachments FOR DELETE
TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE TRIGGER set_email_attachments_updated_at
BEFORE UPDATE ON public.email_attachments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Storage bucket (public so links in emails resolve)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3) Storage policies
CREATE POLICY "Public can read email-attachments"
ON storage.objects FOR SELECT
TO public USING (bucket_id = 'email-attachments');

CREATE POLICY "Admin/Manager can upload email-attachments"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'email-attachments' AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Admin/Manager can update email-attachments"
ON storage.objects FOR UPDATE
TO authenticated USING (
  bucket_id = 'email-attachments' AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Admin/Manager can delete email-attachments"
ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'email-attachments' AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
  )
);
