CREATE OR REPLACE FUNCTION public.delete_tour_with_cascade(p_tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins may delete tours
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can delete tours';
  END IF;

  -- automated_email_log.tour_id is NO ACTION → must clear manually
  DELETE FROM automated_email_log WHERE tour_id = p_tour_id;

  -- All other dependent rows (bookings, tasks, hotels, activities,
  -- tour_custom_forms + responses + fields + exemptions, tour_alerts,
  -- tour_attachments, tour_pickup_options, tour_external_links,
  -- tour_host_assignments, tour_itineraries, tour_itinerary_days/entries,
  -- tour_additional_info_sections, tour_ops_reviews, tour_email_rule_overrides,
  -- host_briefing_tokens, scheduled_emails, etc.) cascade automatically
  -- via foreign keys.

  DELETE FROM tours WHERE id = p_tour_id;

  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'DELETE_TOUR_CASCADE',
    'tours',
    p_tour_id,
    jsonb_build_object('cascade', true)
  );
END;
$$;