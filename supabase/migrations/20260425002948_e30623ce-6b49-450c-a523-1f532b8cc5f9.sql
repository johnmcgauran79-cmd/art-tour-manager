CREATE TABLE public.tour_custom_form_exemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.tour_custom_forms(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  passenger_slot INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (form_id, booking_id, passenger_slot)
);

CREATE INDEX idx_form_exemptions_form_booking
  ON public.tour_custom_form_exemptions(form_id, booking_id);

ALTER TABLE public.tour_custom_form_exemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view form exemptions"
ON public.tour_custom_form_exemptions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can insert form exemptions"
ON public.tour_custom_form_exemptions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can update form exemptions"
ON public.tour_custom_form_exemptions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can delete form exemptions"
ON public.tour_custom_form_exemptions
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);