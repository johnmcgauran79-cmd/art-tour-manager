CREATE OR REPLACE FUNCTION public.dq_contact_issues()
 RETURNS TABLE(issue_key text, issue_type text, entity_id uuid, subject text, detail text, extra jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.dq_is_staff() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
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
     OR trim(c.email) !~* '^[^@\s]+@[^@\s.]+\.[^@\s]+$';
END;
$function$;