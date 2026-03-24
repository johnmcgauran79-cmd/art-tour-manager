-- Insert default email templates for pickup, waiver, profile update, and custom form requests
INSERT INTO email_templates (name, type, subject_template, content_template, from_email, is_default, is_active, created_by)
VALUES 
(
  'Pickup Location Request',
  'pickup_request',
  'Select Your Pickup Location - {{tour_name}}',
  '<p>Dear {{customer_preferred_name}},</p>

<p>As part of your booking for <strong>{{tour_name}}</strong> ({{tour_start_date}} - {{tour_end_date}}), we need you to select your preferred pickup location.</p>

<p>Please click the button below to view the available pickup options and make your selection:</p>

{{pickup_button}}

<p style="color: #666; font-size: 14px;">If you have any questions, please don''t hesitate to contact us.</p>',
  'bookings@australianracingtours.com.au',
  true,
  true,
  '76608e17-b319-4947-9db3-5a17f97c9a4b'
),
(
  'Waiver Request',
  'waiver_request',
  'Tour Waiver - {{tour_name}}',
  '<p>Dear {{customer_preferred_name}},</p>

<p>As part of your booking for <strong>{{tour_name}}</strong> ({{tour_start_date}} - {{tour_end_date}}), we require you to review and sign our tour waiver form.</p>

<p>Please click the button below to review the waiver terms and provide your digital signature:</p>

{{waiver_button}}

<p style="color: #666; font-size: 14px;">If you have any questions, please don''t hesitate to contact us.</p>',
  'bookings@australianracingtours.com.au',
  true,
  true,
  '76608e17-b319-4947-9db3-5a17f97c9a4b'
),
(
  'Profile Update Request',
  'profile_update_request',
  'Update Your Profile Details',
  '<p>Dear {{customer_preferred_name}},</p>

<p>We''d like to ensure we have your most up-to-date information on file. Please review your current details below and click the button to make any corrections.</p>

{{current_details}}

<p style="text-align: center; color: #666; font-size: 14px;">If any of the above details are incorrect or missing, please click below to update them.</p>

{{profile_update_button}}

<div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #2e7d32;">
    <strong>Note:</strong> You can make multiple updates within the expiry timeframe.
  </p>
</div>

<p>If you didn''t request this email or have any questions, please contact us.</p>',
  'bookings@australianracingtours.com.au',
  true,
  true,
  '76608e17-b319-4947-9db3-5a17f97c9a4b'
),
(
  'Custom Form Request',
  'custom_form_request',
  '{{form_title}} - {{tour_name}}',
  '<p>Dear {{customer_preferred_name}},</p>

<p>As part of your booking for <strong>{{tour_name}}</strong> ({{tour_start_date}} - {{tour_end_date}}), we need you to complete a short form.</p>

{{#form_description}}
<p>{{form_description}}</p>
{{/form_description}}

<p>Please click the button below to fill in the required information:</p>

{{custom_form_button}}

{{#is_per_passenger}}
<p style="color: #666; font-size: 14px;">If other passengers on your booking don''t have an email address, you''ll be able to fill in their details as well.</p>
{{/is_per_passenger}}

<p style="color: #666; font-size: 14px;">If you have any questions, please don''t hesitate to contact us.</p>',
  'bookings@australianracingtours.com.au',
  true,
  true,
  '76608e17-b319-4947-9db3-5a17f97c9a4b'
)
ON CONFLICT DO NOTHING;