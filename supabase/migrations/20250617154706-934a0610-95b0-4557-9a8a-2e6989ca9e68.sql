
-- Add task dependencies support
ALTER TABLE public.tasks ADD COLUMN depends_on_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add archived status to tasks
ALTER TYPE public.task_status ADD VALUE 'archived';

-- Create task attachments table for file uploads
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hotel attachments table
CREATE TABLE public.hotel_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tour attachments table
CREATE TABLE public.tour_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for attachments
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task attachments
CREATE POLICY "Users can view task attachments for assigned tasks" ON public.task_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND (
      auth.uid() = t.created_by OR 
      auth.uid() IN (SELECT user_id FROM public.task_assignments WHERE task_id = t.id)
    )
  )
);

CREATE POLICY "Users can upload attachments to assigned tasks" ON public.task_attachments
FOR INSERT WITH CHECK (
  auth.uid() = uploaded_by AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND (
      auth.uid() = t.created_by OR 
      auth.uid() IN (SELECT user_id FROM public.task_assignments WHERE task_id = t.id)
    )
  )
);

-- RLS policies for hotel attachments
CREATE POLICY "Users can view hotel attachments" ON public.hotel_attachments
FOR SELECT USING (true);

CREATE POLICY "Users can upload hotel attachments" ON public.hotel_attachments
FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- RLS policies for tour attachments
CREATE POLICY "Users can view tour attachments" ON public.tour_attachments
FOR SELECT USING (true);

CREATE POLICY "Users can upload tour attachments" ON public.tour_attachments
FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- Storage policies for attachments bucket
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow users to view all files" ON storage.objects
FOR SELECT USING (bucket_id = 'attachments');

CREATE POLICY "Allow users to delete their own files" ON storage.objects
FOR DELETE USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
