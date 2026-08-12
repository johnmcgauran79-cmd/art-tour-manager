ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS partner_handles_billing boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.booking_skips_billing(_booking_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN b.automation_override = 'force_automated' THEN false
      WHEN b.automation_override IN ('manual_billing', 'manual_all') THEN true
      WHEN COALESCE(br.partner_handles_billing, false) THEN true
      WHEN b.automation_override = 'manual_emails' THEN COALESCE(t.manual_billing, false)
      ELSE COALESCE(t.manual_billing, false) -- inherit
    END
  FROM public.bookings b
  LEFT JOIN public.tours t ON t.id = b.tour_id
  LEFT JOIN public.brands br ON br.id = b.brand_id
  WHERE b.id = _booking_id;
$function$;