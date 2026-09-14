CREATE OR REPLACE FUNCTION public.dq_finance_issues()
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
  WITH b AS (
    SELECT bk.id, bk.invoice_reference, bk.status, bk.tour_id,
           t.name AS tour_name, t.start_date,
           trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) AS client_name
    FROM public.bookings bk
    JOIN public.tours t ON t.id = bk.tour_id
    LEFT JOIN public.customers c ON c.id = bk.lead_passenger_id
    WHERE bk.cancelled_at IS NULL AND bk.status <> 'cancelled'
      AND t.status NOT IN ('past','archived','cancelled')
      AND coalesce(t.end_date, t.start_date) >= (now() AT TIME ZONE 'Australia/Brisbane')::date
  ),
  m AS (
    SELECT xm.*, b.client_name, b.tour_name, b.invoice_reference AS booking_reference, b.status AS booking_status
    FROM public.xero_invoice_mappings xm
    JOIN b ON b.id = xm.booking_id
  ),
  m_match AS (
    SELECT m.*,
      EXISTS (
        SELECT 1
        FROM regexp_split_to_table(upper(trim(m.booking_reference)), '[^A-Z0-9]+') AS tok
        WHERE regexp_replace(regexp_replace(tok, '^INV0*', ''), '^0+', '') <> ''
          AND regexp_replace(regexp_replace(tok, '^INV0*', ''), '^0+', '') =
              regexp_replace(regexp_replace(regexp_replace(upper(trim(m.xero_invoice_number)), '[^A-Z0-9]+', '', 'g'), '^INV0*', ''), '^0+', '')
      ) AS matches
    FROM m
    WHERE nullif(trim(coalesce(m.booking_reference,'')),'') IS NOT NULL
      AND nullif(trim(coalesce(m.xero_invoice_number,'')),'') IS NOT NULL
  )
  SELECT 'xero_dead:' || m.id, 'xero_invoice_dead', m.booking_id,
         coalesce(nullif(m.client_name,''), 'Booking'),
         'Linked Xero invoice ' || coalesce(m.xero_invoice_number,'(unknown)') || ' is ' || lower(coalesce(m.xero_status,'unknown')),
         jsonb_build_object('tour', m.tour_name, 'checked_at', m.updated_at, 'invoice', m.xero_invoice_number)
  FROM m WHERE upper(coalesce(m.xero_status,'')) IN ('DELETED','VOIDED')
  UNION ALL
  -- Only flag a booking when NONE of its linked Xero invoices match the recorded reference.
  SELECT 'xero_mismatch:' || mm.booking_id, 'xero_reference_mismatch', mm.booking_id,
         coalesce(nullif(max(mm.client_name),''), 'Booking'),
         'Booking reference ' || max(mm.booking_reference) || ' does not include any linked Xero invoice (' ||
           string_agg(distinct mm.xero_invoice_number, ', ') || ')',
         jsonb_build_object('tour', max(mm.tour_name), 'checked_at', max(mm.updated_at))
  FROM m_match mm
  GROUP BY mm.booking_id
  HAVING bool_or(mm.matches) = false
  UNION ALL
  SELECT 'xero_unlinked:' || b.id, 'xero_not_linked', b.id,
         coalesce(nullif(b.client_name,''), 'Booking'),
         'Booking status is ' || b.status || ' but no invoice number is recorded and no Xero invoice is linked',
         jsonb_build_object('tour', b.tour_name, 'reference', b.invoice_reference)
  FROM b
  WHERE b.status IN ('invoiced','deposited','instalment_paid','fully_paid')
    AND nullif(trim(coalesce(b.invoice_reference,'')),'') IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.xero_invoice_mappings x WHERE x.booking_id = b.id);
END;
$function$;