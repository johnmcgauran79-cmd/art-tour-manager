-- Fix RLS policies for tour_external_links to allow admin access
DROP POLICY "Users can update their own tour external links" ON public.tour_external_links;
DROP POLICY "Users can delete their own tour external links" ON public.tour_external_links;

-- Create comprehensive policies
CREATE POLICY "Users can update tour external links they created or admins can update all" 
ON public.tour_external_links 
FOR UPDATE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete tour external links they created or admins can delete all" 
ON public.tour_external_links 
FOR DELETE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));