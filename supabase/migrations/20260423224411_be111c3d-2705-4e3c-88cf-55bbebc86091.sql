
-- Create table for admin-managed additional from-email addresses
CREATE TABLE public.additional_from_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.additional_from_emails ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (so dropdowns work for all staff)
CREATE POLICY "Authenticated users can view additional from emails"
  ON public.additional_from_emails
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/managers can manage
CREATE POLICY "Admins and managers can insert additional from emails"
  ON public.additional_from_emails
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins and managers can update additional from emails"
  ON public.additional_from_emails
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins and managers can delete additional from emails"
  ON public.additional_from_emails
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- updated_at trigger
CREATE TRIGGER set_additional_from_emails_updated_at
  BEFORE UPDATE ON public.additional_from_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (migrate the hardcoded ones + add admin@)
INSERT INTO public.additional_from_emails (email, label, sort_order) VALUES
  ('bookings@australianracingtours.com.au', 'Bookings', 10),
  ('info@australianracingtours.com.au', 'Info', 20),
  ('admin@australianracingtours.com.au', 'Admin', 30)
ON CONFLICT (email) DO NOTHING;
