
-- Table for default additional info section templates (managed in Settings)
CREATE TABLE public.additional_info_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'info',
  default_content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for per-tour additional info sections
CREATE TABLE public.tour_additional_info_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.additional_info_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'info',
  content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tour_additional_info_tour_id ON public.tour_additional_info_sections(tour_id);
CREATE INDEX idx_tour_additional_info_template_id ON public.tour_additional_info_sections(template_id);

-- RLS for additional_info_templates
ALTER TABLE public.additional_info_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage additional info templates"
ON public.additional_info_templates
FOR ALL
TO authenticated
USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'));

CREATE POLICY "All authenticated users can view active templates"
ON public.additional_info_templates
FOR SELECT
TO authenticated
USING (true);

-- RLS for tour_additional_info_sections
ALTER TABLE public.tour_additional_info_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage tour additional info sections"
ON public.tour_additional_info_sections
FOR ALL
TO authenticated
USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'))
WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Hosts can view additional info for their assigned tours"
ON public.tour_additional_info_sections
FOR SELECT
TO public
USING (is_host_for_tour(auth.uid(), tour_id));

-- Updated_at trigger for templates
CREATE TRIGGER update_additional_info_templates_updated_at
BEFORE UPDATE ON public.additional_info_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for sections  
CREATE TRIGGER update_tour_additional_info_sections_updated_at
BEFORE UPDATE ON public.tour_additional_info_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
