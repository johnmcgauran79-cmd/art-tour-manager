-- 1. Dismissals table -------------------------------------------------------
CREATE TABLE public.data_quality_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_key text NOT NULL,
  issue_type text NOT NULL,
  entity_id uuid,
  note text,
  dismissed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_quality_dismissals TO authenticated;
GRANT ALL ON public.data_quality_dismissals TO service_role;

ALTER TABLE public.data_quality_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view data quality dismissals"
ON public.data_quality_dismissals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can create data quality dismissals"
ON public.data_quality_dismissals FOR INSERT TO authenticated
WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) AND dismissed_by = auth.uid());

CREATE POLICY "Admins and managers can update data quality dismissals"
ON public.data_quality_dismissals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can delete data quality dismissals"
ON public.data_quality_dismissals FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_data_quality_dismissals_updated_at
BEFORE UPDATE ON public.data_quality_dismissals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Shared guard -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dq_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
$$;

-- 3. Contact issues ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dq_contact_issues()
RETURNS TABLE (
  issue_key text,
  issue_type text,
  entity_id uuid,
  subject text,
  detail text,
  extra jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.dq_is_staff() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  -- Duplicate contacts sharing an email address
  WITH dup_email AS (
    SELECT lower(trim(c.email)) AS k,
           count(*) AS n,
           jsonb_agg(jsonb_build_object('id', c.id, 'name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,''))) ORDER BY c.created_at) AS members,
           min(c.id::text) AS any_id
    FROM public.customers c
    WHERE nullif(trim(c.email),'') IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  ),
  dup_name AS (
    SELECT lower(trim(coalesce(c.first_name,'')) || '|' || trim(coalesce(c.last_name,''))) AS k,
           count(*) AS n,
           jsonb_agg(jsonb_build_object('id', c.id, 'email', c.email) ORDER BY c.created_at) AS members,
           min(c.id::text) AS any_id
    FROM public.customers c
    WHERE nullif(trim(c.first_name),'') IS NOT NULL AND nullif(trim(c.last_name),'') IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  ),
  future_travellers AS (
    SELECT DISTINCT cid FROM (
      SELECT b.lead_passenger_id AS cid FROM public.bookings b
      JOIN public.tours t ON t.id = b.tour_id
      WHERE b.cancelled_at IS NULL AND b.status <> 'cancelled' AND t.start_date >= current_date
      UNION ALL
      SELECT b.passenger_2_id FROM public.bookings b
      JOIN public.tours t ON t.id = b.tour_id
      WHERE b.cancelled_at IS NULL AND b.status <> 'cancelled' AND t.start_date >= current_date
      UNION ALL
      SELECT b.passenger_3_id FROM public.bookings b
      JOIN public.tours t ON t.id = b.tour_id
      WHERE b.cancelled_at IS NULL AND b.status <> 'cancelled' AND t.start_date >= current_date
    ) s WHERE cid IS NOT NULL
  ),
  booked_contacts AS (
    SELECT DISTINCT b.lead_passenger_id AS cid FROM public.bookings b WHERE b.lead_passenger_id IS NOT NULL
  )
  SELECT 'dup_email:' || d.k, 'duplicate_email', d.any_id::uuid,
         d.k, d.n || ' contacts share this email address', jsonb_build_object('members', d.members)
  FROM dup_email d
  UNION ALL
  SELECT 'dup_name:' || d.k, 'duplicate_name', d.any_id::uuid,
         replace(d.k, '|', ' '), d.n || ' contacts share this name', jsonb_build_object('members', d.members)
  FROM dup_name d
  UNION ALL
  SELECT 'missing_phone:' || c.id, 'missing_phone', c.id,
         trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
         'No phone number, travelling on an upcoming tour', jsonb_build_object('email', c.email)
  FROM public.customers c
  JOIN future_travellers f ON f.cid = c.id
  WHERE nullif(trim(coalesce(c.phone,'')),'') IS NULL
    AND c.phone_missing_acknowledged_at IS NULL
  UNION ALL
  SELECT 'bad_email:' || c.id, 'invalid_email', c.id,
         trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
         CASE WHEN nullif(trim(coalesce(c.email,'')),'') IS NULL THEN 'No email address recorded'
              ELSE 'Email address does not look valid: ' || c.email END,
         jsonb_build_object('email', c.email)
  FROM public.customers c
  JOIN booked_contacts bc ON bc.cid = c.id
  WHERE nullif(trim(coalesce(c.email,'')),'') IS NULL
     OR trim(c.email) !~* '^[^@\s]+@[^@\s.]+\.[^@\s]+$'
  UNION ALL
  SELECT 'missing_location:' || c.id, 'missing_location', c.id,
         trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
         'No home state or country recorded', '{}'::jsonb
  FROM public.customers c
  JOIN booked_contacts bc ON bc.cid = c.id
  WHERE nullif(trim(coalesce(c.state,'')),'') IS NULL
    AND nullif(trim(coalesce(c.country,'')),'') IS NULL;
END;
$$;

-- 4. Lead / enquiry issues --------------------------------------------------
CREATE OR REPLACE FUNCTION public.dq_lead_issues()
RETURNS TABLE (
  issue_key text,
  issue_type text,
  entity_id uuid,
  subject text,
  detail text,
  extra jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.dq_is_staff() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH l AS (
    SELECT le.*,
           trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) AS contact_name,
           t.name AS tour_name
    FROM public.leads le
    LEFT JOIN public.customers c ON c.id = le.customer_id
    LEFT JOIN public.tours t ON t.id = le.tour_id
  ),
  active AS (
    SELECT * FROM l WHERE stage NOT IN ('won','lost','none')
  )
  SELECT 'lead_no_owner:' || a.id, 'lead_no_owner', a.id, coalesce(nullif(a.contact_name,''), 'Enquiry'),
         'Active enquiry with no owner', jsonb_build_object('stage', a.stage, 'tour', a.tour_name)
  FROM active a WHERE a.owner_id IS NULL
  UNION ALL
  SELECT 'lead_no_tour:' || a.id, 'lead_no_tour', a.id, coalesce(nullif(a.contact_name,''), 'Enquiry'),
         'Active enquiry not linked to a tour', jsonb_build_object('stage', a.stage)
  FROM active a WHERE a.tour_id IS NULL
  UNION ALL
  SELECT 'lead_no_pax:' || a.id, 'lead_no_pax', a.id, coalesce(nullif(a.contact_name,''), 'Enquiry'),
         'Passenger numbers unknown', jsonb_build_object('stage', a.stage, 'tour', a.tour_name)
  FROM active a WHERE a.passengers IS NULL OR a.passengers = 0
  UNION ALL
  SELECT 'lead_no_lost_reason:' || x.id, 'lead_no_lost_reason', x.id, coalesce(nullif(x.contact_name,''), 'Enquiry'),
         'Lost enquiry with no reason recorded', jsonb_build_object('tour', x.tour_name)
  FROM l x WHERE x.stage = 'lost' AND nullif(trim(coalesce(x.lost_reason,'')),'') IS NULL
  UNION ALL
  SELECT 'lead_won_no_booking:' || x.id, 'lead_won_no_booking', x.id, coalesce(nullif(x.contact_name,''), 'Enquiry'),
         'Won enquiry with no booking linked', jsonb_build_object('tour', x.tour_name)
  FROM l x WHERE x.stage = 'won' AND x.booking_id IS NULL
  UNION ALL
  SELECT 'lead_no_source:' || x.id, 'lead_no_source', x.id, coalesce(nullif(x.contact_name,''), 'Enquiry'),
         'No lead source recorded, so attribution reporting misses it', jsonb_build_object('stage', x.stage)
  FROM l x
  WHERE nullif(trim(coalesce(x.source,'')),'') IS NULL
    AND nullif(trim(coalesce(x.source_channel,'')),'') IS NULL
    AND nullif(trim(coalesce(x.utm_source,'')),'') IS NULL;
END;
$$;

-- 5. Finance / Xero issues --------------------------------------------------
CREATE OR REPLACE FUNCTION public.dq_finance_issues()
RETURNS TABLE (
  issue_key text,
  issue_type text,
  entity_id uuid,
  subject text,
  detail text,
  extra jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.dq_is_staff() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH b AS (
    SELECT bk.id, bk.invoice_reference, bk.status, bk.tour_id,
           t.name AS tour_name, t.start_date,
           trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) AS client_name
    FROM public.bookings bk
    LEFT JOIN public.tours t ON t.id = bk.tour_id
    LEFT JOIN public.customers c ON c.id = bk.lead_passenger_id
    WHERE bk.cancelled_at IS NULL AND bk.status <> 'cancelled'
  ),
  m AS (
    SELECT xm.*, b.client_name, b.tour_name, b.invoice_reference AS booking_reference, b.status AS booking_status
    FROM public.xero_invoice_mappings xm
    JOIN b ON b.id = xm.booking_id
  )
  SELECT 'xero_dead:' || m.id, 'xero_invoice_dead', m.booking_id,
         coalesce(nullif(m.client_name,''), 'Booking'),
         'Linked Xero invoice ' || coalesce(m.xero_invoice_number,'(unknown)') || ' is ' || lower(coalesce(m.xero_status,'unknown')),
         jsonb_build_object('tour', m.tour_name, 'checked_at', m.updated_at, 'invoice', m.xero_invoice_number)
  FROM m WHERE upper(coalesce(m.xero_status,'')) IN ('DELETED','VOIDED')
  UNION ALL
  SELECT 'xero_mismatch:' || m.id, 'xero_reference_mismatch', m.booking_id,
         coalesce(nullif(m.client_name,''), 'Booking'),
         'Booking reference ' || m.booking_reference || ' does not match linked Xero invoice ' || m.xero_invoice_number,
         jsonb_build_object('tour', m.tour_name, 'checked_at', m.updated_at)
  FROM m
  WHERE nullif(trim(coalesce(m.booking_reference,'')),'') IS NOT NULL
    AND nullif(trim(coalesce(m.xero_invoice_number,'')),'') IS NOT NULL
    AND regexp_replace(upper(trim(m.booking_reference)), '^(INV[-\s]*)?0*', '') <>
        regexp_replace(upper(trim(m.xero_invoice_number)), '^(INV[-\s]*)?0*', '')
  UNION ALL
  SELECT 'xero_unlinked:' || b.id, 'xero_not_linked', b.id,
         coalesce(nullif(b.client_name,''), 'Booking'),
         'Booking status is ' || b.status || ' but no Xero invoice is linked',
         jsonb_build_object('tour', b.tour_name, 'reference', b.invoice_reference)
  FROM b
  WHERE b.status IN ('invoiced','deposited','instalment_paid','fully_paid')
    AND NOT EXISTS (SELECT 1 FROM public.xero_invoice_mappings x WHERE x.booking_id = b.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dq_contact_issues() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dq_lead_issues() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dq_finance_issues() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dq_is_staff() TO authenticated;