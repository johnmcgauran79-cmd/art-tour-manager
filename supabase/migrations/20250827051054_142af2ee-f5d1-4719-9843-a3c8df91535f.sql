-- Create table for tour external links
CREATE TABLE public.tour_external_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tour_external_links ENABLE ROW LEVEL SECURITY;

-- Create policies for tour external links
CREATE POLICY "Users can view tour external links" 
ON public.tour_external_links 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create tour external links" 
ON public.tour_external_links 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tour external links" 
ON public.tour_external_links 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own tour external links" 
ON public.tour_external_links 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tour_external_links_updated_at
BEFORE UPDATE ON public.tour_external_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();