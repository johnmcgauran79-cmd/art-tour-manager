INSERT INTO email_templates (name, type, subject_template, from_email, content_template, is_active, is_default, created_by)
VALUES (
  'Welcome Email V2 (Styled)',
  'booking_confirmation',
  'Booking Confirmation - {{tour_name}}',
  'bookings@australianracingtours.com.au',
  '<p>Dear {{customer_first_name}},</p>
<p>Thank you for booking with <strong>Australian Racing Tours</strong>. We have received your deposit for <strong>{{tour_name}}</strong> and your place is now confirmed. We are delighted to have you joining us on what promises to be an incredible racing adventure.</p>
<p>Please take a moment to review your booking details below and let us know if anything needs updating.</p>
<p>{{#has_passenger_2}}{{#passenger_2_missing_email}}</p>
<p style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:14px;color:#92400e;">If you haven''t already, please let us know your travel partner''s contact email and phone number so they can also receive tour updates.</p>
<p>{{/passenger_2_missing_email}}{{/has_passenger_2}}</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background-color:#1a2332;padding:10px 20px;border-radius:6px;"><span style="color:#f5c518;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Tour Details</span></td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 24px;">
<tr><td style="padding:6px 0;color:#888;font-size:13px;width:140px;">Tour</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2332;">{{tour_name}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Location</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{tour_location}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Dates</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{tour_start_date}} – {{tour_end_date}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Duration</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{tour_days}} days, {{tour_nights}} nights</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background-color:#1a2332;padding:10px 20px;border-radius:6px;"><span style="color:#f5c518;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Passenger Information</span></td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
<tr><td style="padding:6px 0;color:#888;font-size:13px;width:140px;">Lead Passenger</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2332;">{{lead_passenger_first_name}} {{lead_passenger_last_name}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Preferred Name</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{lead_passenger_preferred_name}}</td></tr>
{{#has_passenger_2}}<tr><td style="padding:6px 0;color:#888;font-size:13px;">Passenger 2</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2332;">{{passenger_2_first_name}} {{passenger_2_last_name}}</td></tr>{{/has_passenger_2}}
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Total Passengers</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{booking_passenger_count}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Phone</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{customer_phone}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Dietary</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{lead_passenger_dietary_requirements}}{{#has_passenger_2}}, {{passenger_2_dietary_requirements}}{{/has_passenger_2}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Accessibility</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{lead_passenger_accessibility_needs}}{{#has_passenger_2}}, {{passenger_2_accessibility_needs}}{{/has_passenger_2}}</td></tr>
<tr><td style="padding:6px 0;color:#888;font-size:13px;">Emergency Contact</td><td style="padding:6px 0;font-size:14px;color:#55575d;">{{customer_emergency_contact_name}} – {{customer_emergency_contact_phone}}</td></tr>
</table>

<p style="text-align:center;margin:20px 0;">{{profile_update_button}}</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background-color:#1a2332;padding:10px 20px;border-radius:6px;"><span style="color:#f5c518;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Accommodation</span></td></tr></table>

<p>{{hotel_details}}</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background-color:#1a2332;padding:10px 20px;border-radius:6px;"><span style="color:#f5c518;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Itinerary &amp; Tour Information</span></td></tr></table>

<p>Your current itinerary and additional tour information is available below.</p>
<p style="text-align:center;margin:20px 0;">{{itinerary_button}}</p>

<p>We have also included some important early information for this tour:</p>
<p>{{additional_info_blocks}}</p>

{{#needs_passport_submission}}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background-color:#1a2332;padding:10px 20px;border-radius:6px;"><span style="color:#f5c518;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Passport Details Required</span></td></tr></table>
<p>This tour requires passport details for all travelling passengers. Please submit yours at your earliest convenience.</p>
<p style="text-align:center;margin:20px 0;">{{travel_docs_button}}</p>
{{/needs_passport_submission}}

<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background-color:#1a2332;padding:10px 20px;border-radius:6px;"><span style="color:#f5c518;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">What Happens Next</span></td></tr></table>

<p>To keep things clear and easy, we will send just a few key updates in the lead-up to your tour:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 24px;">
<tr><td style="padding:8px 12px 8px 0;vertical-align:top;width:24px;font-size:16px;color:#f5c518;">✦</td><td style="padding:8px 0;font-size:14px;color:#55575d;"><strong style="color:#1a2332;">Six Month Update</strong> – a general tour update with the latest itinerary and any important reminders</td></tr>
<tr><td style="padding:8px 12px 8px 0;vertical-align:top;font-size:16px;color:#f5c518;">✦</td><td style="padding:8px 0;font-size:14px;color:#55575d;"><strong style="color:#1a2332;">100 Day Update</strong> – your final payment reminder, itinerary and a practical guide to help you prepare</td></tr>
<tr><td style="padding:8px 12px 8px 0;vertical-align:top;font-size:16px;color:#f5c518;">✦</td><td style="padding:8px 0;font-size:14px;color:#55575d;"><strong style="color:#1a2332;">Final Update</strong> – sent approximately two weeks before departure with your guest document, final itinerary details, and meeting information</td></tr>
</table>

<p>If you have any questions in the meantime, please feel free to get in touch.</p>
<p>Best regards,<br><strong>ART Team</strong></p>',
  true,
  false,
  '2b537fb4-3378-423d-b7d9-a990ceb3e7b6'
);