
CREATE OR REPLACE FUNCTION public.delete_tour_with_cascade(p_tour_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete scheduled emails
  DELETE FROM scheduled_emails WHERE tour_id = p_tour_id;
  DELETE FROM scheduled_emails WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);

  -- Delete automated email log entries
  DELETE FROM automated_email_log WHERE tour_id = p_tour_id;
  DELETE FROM automated_email_log WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete automated report log entries
  DELETE FROM automated_report_log WHERE tour_id = p_tour_id;
  
  -- Delete status change email queue
  DELETE FROM status_change_email_queue WHERE tour_id = p_tour_id;
  
  -- Delete email logs
  DELETE FROM email_logs WHERE tour_id = p_tour_id;
  
  -- Delete tour alerts
  DELETE FROM tour_alerts WHERE tour_id = p_tour_id;
  
  -- Delete customer access tokens for bookings on this tour
  DELETE FROM customer_access_tokens WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking waivers
  DELETE FROM booking_waivers WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking travel docs
  DELETE FROM booking_travel_docs WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking comments
  DELETE FROM booking_comments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete booking assignments
  DELETE FROM booking_assignments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete hotel bookings
  DELETE FROM hotel_bookings WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  
  -- Delete activity bookings
  DELETE FROM activity_bookings WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = p_tour_id);
  DELETE FROM activity_bookings WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  
  -- Delete bookings
  DELETE FROM bookings WHERE tour_id = p_tour_id;
  
  -- Delete activity journeys
  DELETE FROM activity_journeys WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  
  -- Delete activity attachments
  DELETE FROM activity_attachments WHERE activity_id IN (SELECT id FROM activities WHERE tour_id = p_tour_id);
  
  -- Delete activities
  DELETE FROM activities WHERE tour_id = p_tour_id;
  
  -- Delete hotel attachments
  DELETE FROM hotel_attachments WHERE hotel_id IN (SELECT id FROM hotels WHERE tour_id = p_tour_id);
  
  -- Delete hotels
  DELETE FROM hotels WHERE tour_id = p_tour_id;
  
  -- Delete task assignments, comments, attachments for tour tasks
  DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  DELETE FROM task_dependencies WHERE task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id) 
     OR depends_on_task_id IN (SELECT id FROM tasks WHERE tour_id = p_tour_id);
  
  -- Delete tasks
  DELETE FROM tasks WHERE tour_id = p_tour_id;
  
  -- Delete tour host assignments
  DELETE FROM tour_host_assignments WHERE tour_id = p_tour_id;
  
  -- Delete tour attachments
  DELETE FROM tour_attachments WHERE tour_id = p_tour_id;
  
  -- Delete tour pickup options
  DELETE FROM tour_pickup_options WHERE tour_id = p_tour_id;
  
  -- Delete tour custom form responses and forms
  DELETE FROM custom_form_responses WHERE form_id IN (SELECT id FROM tour_custom_forms WHERE tour_id = p_tour_id);
  DELETE FROM tour_custom_forms WHERE tour_id = p_tour_id;
  
  -- Delete tour itinerary entries
  DELETE FROM tour_itinerary_entries WHERE tour_id = p_tour_id;
  
  -- Delete tour external links
  DELETE FROM tour_external_links WHERE tour_id = p_tour_id;
  
  -- Finally delete the tour
  DELETE FROM tours WHERE id = p_tour_id;
  
  -- Log the operation
  INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'DELETE_TOUR_CASCADE',
    'tours',
    p_tour_id,
    jsonb_build_object('cascade', true)
  );
END;
$function$;
