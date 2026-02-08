
-- Create booking_waivers table to store signed waivers
CREATE TABLE public.booking_waivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  passenger_slot INTEGER NOT NULL DEFAULT 1,
  signed_name TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  waiver_version INTEGER NOT NULL DEFAULT 1,
  waiver_content TEXT NOT NULL,
  token_id UUID REFERENCES public.customer_access_tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_waivers ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view waivers
CREATE POLICY "Authenticated users can view waivers"
  ON public.booking_waivers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert waivers (staff creating on behalf)
CREATE POLICY "Authenticated users can insert waivers"
  ON public.booking_waivers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Anon users can insert waivers (customers signing via token)
CREATE POLICY "Anon users can insert waivers via token"
  ON public.booking_waivers FOR INSERT
  WITH CHECK (auth.role() = 'anon');

-- Anon users can read waivers (for the signing page to check if already signed)
CREATE POLICY "Anon users can read waivers"
  ON public.booking_waivers FOR SELECT
  USING (auth.role() = 'anon');

-- Index for quick lookup by booking
CREATE INDEX idx_booking_waivers_booking_id ON public.booking_waivers(booking_id);
CREATE INDEX idx_booking_waivers_customer_id ON public.booking_waivers(customer_id);

-- Insert default waiver text into general_settings
INSERT INTO public.general_settings (setting_key, setting_value, description)
VALUES (
  'waiver_form_text',
  '"1. Release of Liability:\n\nI acknowledge and agree that Australian Racing Tours and its affiliates, agents, employees, officers, directors, successors, and assigns (collectively referred to as \"the Company\") shall not be held liable for any injury or death arising from my participation in the tour organised by the Company.\n\n2. Acknowledgement of Risk:\n\nI understand and acknowledge that the tour activities may involve certain risks and hazards, including but not limited to, transportation risks, physical exertion, weather conditions, and unpredictable events beyond the control of the Company. I voluntarily assume all such risks and hazards.\n\n3. Responsibility for Preparation:\n\nI confirm that I have made adequate preparations for the tour, including obtaining any necessary travel documents, vaccinations, and insurance coverage.\n\n4. Confirmation of Physical Condition:\n\nI confirm that I am physically fit and capable of participating in the tour activities. I will promptly notify the Company of any changes in my physical condition that may affect my ability to participate. I agree that if at any time during the tour that I believe anything is unsafe for me or beyond my capability, I will immediately advise the Company of such condition(s) AND DECLINE TO PARTICIPATE; or, if I elect to participate notwithstanding my belief of unsafe conditions or my inability to participate, I acknowledge and agree that my participation is and shall be at my own risk.\n\n5. Changes to Tour:\n\nI understand that the Company reserves the right to make changes to the tour itinerary, accommodation, transportation, and activities without prior notice, and I agree to comply with such changes.\n\n6. Rights of the Company – Photography Consent:\n\nI grant the Company full rights to take photographs or videos of me during the tour. I consent to the use of such photographs or videos for promotional, advertising, or any other commercial purposes related to the Company''s business without compensation to me. I understand they may edit, publish, and distribute them without my approval or entitlement to royalties.\n\n7. Compliance with Laws, Regulations, and Rules:\n\nI agree to comply with all applicable laws, regulations, and rules of the tour destinations, including but not limited to, customs, immigration, and safety regulations.\n\n8. Health and Insurance:\n\nI understand that the Company does not provide any form of medical insurance coverage and I am solely responsible for ensuring that I have adequate medical insurance coverage for the duration of the tour.\n\nI agree to disclose any pre-existing medical conditions or allergies to the Company and to carry necessary medications with me for the duration of the tour.\n\n9. Travel insurance general:\n\nI understand that the Company does not provide any form of travel insurance coverage and I am solely responsible for ensuring that I obtain and maintain adequate travel insurance coverage for the duration of the tour for any loss, damage, accident, delay, expense, or any unexpected events that may occur.\n\n10. Consent to Medical Assistance or Treatment and Acceptance of Related Expenses:\n\nIn the event of any injury, illness, or medical emergency that may occur during the tour, I hereby consent to have a doctor, nurse, other medical, health care or medical emergency personnel, or personnel of the Company to provide me with medical assistance or treatment deemed necessary for my well-being. I further give my consent to emergency transportation and the administration by medical emergency personnel or by personnel of the Company of any first aid and/or medical treatment. I acknowledge and accept that any expenses incurred for medical treatment, evacuation, or repatriation shall be my sole responsibility. I agree and accept all responsibility for costs related to such medical assistance or treatment, including but not limited to, medical transportation, hospitalisation, and medication expenses."'::jsonb,
  'Waiver form text content that customers must agree to before tour participation. Editable by admins.'
)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Insert waiver version tracker
INSERT INTO public.general_settings (setting_key, setting_value, description)
VALUES (
  'waiver_form_version',
  '1'::jsonb,
  'Current version number of the waiver form. Incremented when waiver text is updated.'
)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
