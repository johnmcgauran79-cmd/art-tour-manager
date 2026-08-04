-- 1. booking_travel_docs: remove unauthenticated write access
DROP POLICY IF EXISTS "Anon can insert via edge functions" ON public.booking_travel_docs;
DROP POLICY IF EXISTS "Anon can update via edge functions" ON public.booking_travel_docs;

-- 2. booking_waivers: restrict to authenticated staff only
DROP POLICY IF EXISTS "Anon users can read waivers" ON public.booking_waivers;
DROP POLICY IF EXISTS "Anon users can insert waivers via token" ON public.booking_waivers;
DROP POLICY IF EXISTS "Authenticated users can view waivers" ON public.booking_waivers;
DROP POLICY IF EXISTS "Authenticated users can insert waivers" ON public.booking_waivers;

CREATE POLICY "Authenticated users can view waivers"
ON public.booking_waivers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert waivers"
ON public.booking_waivers FOR INSERT TO authenticated WITH CHECK (true);

-- 3. customer_access_tokens: stop public enumeration of tokens
DROP POLICY IF EXISTS "Public can validate tokens" ON public.customer_access_tokens;
DROP POLICY IF EXISTS "System can update token usage" ON public.customer_access_tokens;

CREATE POLICY "Staff can update customer access tokens"
ON public.customer_access_tokens FOR UPDATE TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR
  check_user_role(auth.uid(), 'manager') OR
  check_user_role(auth.uid(), 'booking_agent')
);

-- 4. tour_custom_form_responses: no public read/write
DROP POLICY IF EXISTS "Public can read form responses" ON public.tour_custom_form_responses;
DROP POLICY IF EXISTS "Anon can insert form responses via edge functions" ON public.tour_custom_form_responses;
DROP POLICY IF EXISTS "Anon can update form responses via edge functions" ON public.tour_custom_form_responses;

CREATE POLICY "Authenticated users can view form responses"
ON public.tour_custom_form_responses FOR SELECT TO authenticated USING (true);

-- 5. invoice_sync_dismissals: admin/manager only
DROP POLICY IF EXISTS "Authenticated users can manage invoice sync dismissals" ON public.invoice_sync_dismissals;

CREATE POLICY "Admins and managers can manage invoice sync dismissals"
ON public.invoice_sync_dismissals FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'));

-- 6. internal operational links / pickup options: authenticated only
DROP POLICY IF EXISTS "Public can view tour pickup options" ON public.tour_pickup_options;
CREATE POLICY "Authenticated users can view tour pickup options"
ON public.tour_pickup_options FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view tour external links" ON public.tour_external_links;
CREATE POLICY "Authenticated users can view tour external links"
ON public.tour_external_links FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view hotel external links" ON public.hotel_external_links;
CREATE POLICY "Authenticated users can view hotel external links"
ON public.hotel_external_links FOR SELECT TO authenticated USING (true);

-- Revoke leftover anon Data API access on the tightened tables
REVOKE ALL ON public.booking_travel_docs FROM anon;
REVOKE ALL ON public.booking_waivers FROM anon;
REVOKE ALL ON public.customer_access_tokens FROM anon;
REVOKE ALL ON public.tour_custom_form_responses FROM anon;
REVOKE ALL ON public.tour_pickup_options FROM anon;
REVOKE ALL ON public.tour_external_links FROM anon;
REVOKE ALL ON public.hotel_external_links FROM anon;

GRANT ALL ON public.booking_travel_docs TO service_role;
GRANT ALL ON public.booking_waivers TO service_role;
GRANT ALL ON public.customer_access_tokens TO service_role;
GRANT ALL ON public.tour_custom_form_responses TO service_role;
GRANT ALL ON public.tour_pickup_options TO service_role;