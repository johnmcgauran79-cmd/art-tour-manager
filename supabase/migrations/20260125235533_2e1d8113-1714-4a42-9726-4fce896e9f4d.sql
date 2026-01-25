-- Create activity_attachments table following the same pattern as task_attachments and tour_attachments
CREATE TABLE public.activity_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view activity attachments"
ON public.activity_attachments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert activity attachments"
ON public.activity_attachments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete activity attachments"
ON public.activity_attachments
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_activity_attachments_activity_id ON public.activity_attachments(activity_id);