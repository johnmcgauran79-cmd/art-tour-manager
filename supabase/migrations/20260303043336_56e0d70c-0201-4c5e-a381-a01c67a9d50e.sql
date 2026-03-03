
-- Custom form definition (one per tour)
CREATE TABLE public.tour_custom_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  form_title text NOT NULL DEFAULT 'Custom Form',
  form_description text,
  is_published boolean NOT NULL DEFAULT false,
  response_mode text NOT NULL DEFAULT 'per_passenger' CHECK (response_mode IN ('per_passenger', 'per_booking')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tour_id)
);

-- Form fields
CREATE TABLE public.tour_custom_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.tour_custom_forms(id) ON DELETE CASCADE,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox', 'textarea')),
  field_options jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  placeholder text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Form responses
CREATE TABLE public.tour_custom_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.tour_custom_forms(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id),
  passenger_slot integer NOT NULL DEFAULT 1,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  token_id uuid REFERENCES public.customer_access_tokens(id),
  UNIQUE(form_id, booking_id, passenger_slot)
);

-- Indexes
CREATE INDEX idx_custom_forms_tour ON public.tour_custom_forms(tour_id);
CREATE INDEX idx_custom_form_fields_form ON public.tour_custom_form_fields(form_id);
CREATE INDEX idx_custom_form_responses_form ON public.tour_custom_form_responses(form_id);
CREATE INDEX idx_custom_form_responses_booking ON public.tour_custom_form_responses(booking_id);

-- RLS
ALTER TABLE public.tour_custom_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_custom_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_custom_form_responses ENABLE ROW LEVEL SECURITY;

-- Forms: staff can manage, hosts can view
CREATE POLICY "Staff can manage custom forms" ON public.tour_custom_forms FOR ALL
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'))
  WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Hosts can view forms for assigned tours" ON public.tour_custom_forms FOR SELECT
  USING (is_host_for_tour(auth.uid(), tour_id));

-- Fields: staff can manage
CREATE POLICY "Staff can manage form fields" ON public.tour_custom_form_fields FOR ALL
  USING (EXISTS (SELECT 1 FROM public.tour_custom_forms f WHERE f.id = form_id AND (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tour_custom_forms f WHERE f.id = form_id AND (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'))));

-- Responses: staff can view/manage, anon can insert/update via edge functions
CREATE POLICY "Staff can manage form responses" ON public.tour_custom_form_responses FOR ALL
  USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'))
  WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager') OR check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Anon can insert form responses via edge functions" ON public.tour_custom_form_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon can update form responses via edge functions" ON public.tour_custom_form_responses FOR UPDATE
  USING (true);

CREATE POLICY "Public can read form responses" ON public.tour_custom_form_responses FOR SELECT
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_tour_custom_forms_updated_at BEFORE UPDATE ON public.tour_custom_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tour_custom_form_fields_updated_at BEFORE UPDATE ON public.tour_custom_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tour_custom_form_responses_updated_at BEFORE UPDATE ON public.tour_custom_form_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
