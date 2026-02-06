-- Update the passport details request template with correct merge fields
UPDATE email_templates 
SET content_template = '<p>Dear {{customer_first_name}},</p>

<p>We require your passport details for your upcoming tour:</p>

<h3>{{tour_name}}</h3>
<p><strong>Tour Dates:</strong> {{tour_start_date}} - {{tour_end_date}}</p>

{{existing_passport_details}}

{{^has_passport_details}}
<p><strong>No travel documents on file yet.</strong> Please provide your passport details as soon as possible.</p>
{{/has_passport_details}}

<p>Please click the button below to provide or update your travel document details:</p>

<p style="text-align: center; margin: 30px 0;">{{travel_docs_button}}</p>

<p><strong>Note:</strong> This link will expire in 72 hours. Your passport details are securely stored and will be automatically deleted 30 days after your tour ends.</p>

<p>If you have any questions, please don''t hesitate to contact us.</p>

<p>Kind regards,</p>
<p><strong>Australian Racing Tours</strong></p>',
updated_at = now()
WHERE type = 'travel_documents_request';