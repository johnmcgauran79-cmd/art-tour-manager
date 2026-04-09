
CREATE TABLE public.custom_card_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  header_title TEXT NOT NULL DEFAULT '',
  header_emoji TEXT NOT NULL DEFAULT '',
  accent_color TEXT NOT NULL DEFAULT 'grey',
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_card_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view
CREATE POLICY "Authenticated users can view custom card templates"
  ON public.custom_card_templates FOR SELECT
  TO authenticated
  USING (true);

-- Admin and Manager can insert
CREATE POLICY "Admin and Manager can create custom card templates"
  ON public.custom_card_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Admin and Manager can update
CREATE POLICY "Admin and Manager can update custom card templates"
  ON public.custom_card_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Admin and Manager can delete
CREATE POLICY "Admin and Manager can delete custom card templates"
  ON public.custom_card_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_custom_card_templates_updated_at
  BEFORE UPDATE ON public.custom_card_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
