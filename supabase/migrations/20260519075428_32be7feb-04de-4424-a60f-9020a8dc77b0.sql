CREATE OR REPLACE FUNCTION public.delete_tour_with_cascade(p_tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM scheduled_emails WHERE tour_id = p_tour_id;
  DELETE FROM scheduled_emails WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);

  DELETE FROM automated_email_log WHERE tour_id = p_tour_id;
  DELETE FROM automated_email_log WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);

  DELETE FROM automated_report_log WHERE tour_id = p_tour_id;
  DELETE FROM status_change_email_queue WHERE tour_id = p_tour_id;
  DELETE FROM email_logs WHERE tour_id = p_tour_id;
  DELETE FROM tour_alerts WHERE tour_id = p_tour_id;
  DELETE FROM host_briefing_tokens WHERE tour_id = p_tour_id;
  DELETE FROM customer_access_tokens WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM booking_waivers WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM booking_travel_docs WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM booking_comments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM booking_assignments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM hotel_bookings WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM activity_bookings WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM activity_bookings WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  DELETE FROM bookings WHERE tour_id = p_tour_id;
  DELETE FROM activity_journeys WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  DELETE FROM activity_attachments WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  DELETE FROM activities WHERE tour_id = p_tour_id;
  DELETE FROM hotel_attachments WHERE hotel_id IN (SELECT id FROM hotels WHERE tour_id = p_tour_id);
  DELETE FROM hotels WHERE tour_id = p_tour_id;

  DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  -- task_dependencies table no longer exists; skip
  DELETE FROM tasks WHERE tour_id = p_tour_id;

  DELETE FROM tour_host_assignments WHERE tour_id = p_tour_id;
  DELETE FROM tour_attachments WHERE tour_id = p_tour_id;
  DELETE FROM tour_pickup_options WHERE tour_id = p_tour_id;
  DELETE FROM custom_form_responses WHERE form_id IN (SELECT id FROM tour_custom_forms WHERE tour_id = p_tour_id);
  DELETE FROM tour_custom_forms WHERE tour_id = p_tour_id;
  DELETE FROM tour_itinerary_entries WHERE tour_id = p_tour_id;
  DELETE FROM tour_external_links WHERE tour_id = p_tour_id;

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