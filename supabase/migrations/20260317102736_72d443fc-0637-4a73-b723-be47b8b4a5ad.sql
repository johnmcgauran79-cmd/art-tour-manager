
-- Table to store per-tour email template overrides for automated email rules
CREATE TABLE public.tour_email_rule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.automated_email_rules(id) ON DELETE CASCADE,
  email_template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tour_id, rule_id)
);

-- Enable RLS
ALTER TABLE public.tour_email_rule_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can manage all overrides
CREATE POLICY "Admins can manage tour email rule overrides"
ON public.tour_email_rule_overrides
FOR ALL
TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

-- Managers can manage all overrides
CREATE POLICY "Managers can manage tour email rule overrides"
ON public.tour_email_rule_overrides
FOR ALL
TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

-- Booking agents can view overrides
CREATE POLICY "Booking agents can view tour email rule overrides"
ON public.tour_email_rule_overrides
FOR SELECT
TO authenticated
USING (check_user_role(auth.uid(), 'booking_agent'));

-- Trigger for updated_at
CREATE TRIGGER update_tour_email_rule_overrides_updated_at
BEFORE UPDATE ON public.tour_email_rule_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
