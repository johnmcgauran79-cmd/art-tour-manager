-- Insert default travel documents request email template
INSERT INTO public.email_templates (
  name,
  type,
  subject_template,
  content_template,
  from_email,
  is_default,
  is_active,
  created_by
) VALUES (
  'Travel Documents Request',
  'travel_documents_request',
  'Travel Documents Required - {{tour_name}}',
  '<p>Dear {{customer_first_name}},</p>

<p>We require your passport details for your upcoming tour:</p>

<div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <h3 style="margin: 0 0 10px 0; color: #2e7d32;">{{tour_name}}</h3>
  <p style="margin: 0; font-size: 14px;">
    <strong>Tour Dates:</strong> {{tour_start_date}} - {{tour_end_date}}
  </p>
</div>

{{#has_passport_details}}
<div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <h4 style="margin: 0 0 10px 0; color: #333;">Current Details on File:</h4>
  <ul style="margin: 0; padding-left: 20px;">
    {{#passport_number}}<li>Passport Number: {{passport_number}}</li>{{/passport_number}}
    {{#passport_country}}<li>Passport Country: {{passport_country}}</li>{{/passport_country}}
    {{#passport_expiry_date}}<li>Expiry Date: {{passport_expiry_date}}</li>{{/passport_expiry_date}}
    {{#nationality}}<li>Nationality: {{nationality}}</li>{{/nationality}}
  </ul>
</div>
{{/has_passport_details}}

{{^has_passport_details}}
<div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <p style="margin: 0; color: #856404;">
    <strong>No travel documents on file yet.</strong> Please provide your passport details as soon as possible.
  </p>
</div>
{{/has_passport_details}}

<p>Please click the button below to provide or update your travel document details:</p>

{{travel_docs_button}}

<div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #1565c0;">
    <strong>Note:</strong> This link will expire in 72 hours. Your passport details are securely stored and will be automatically deleted 30 days after your tour ends.
  </p>
</div>

<p>If you have any questions, please don''t hesitate to contact us.</p>

<p>Kind regards,<br><strong>Australian Racing Tours</strong></p>',
  'info@australianracingtours.com.au',
  true,
  true,
  '00000000-0000-0000-0000-000000000000'
) ON CONFLICT DO NOTHING;