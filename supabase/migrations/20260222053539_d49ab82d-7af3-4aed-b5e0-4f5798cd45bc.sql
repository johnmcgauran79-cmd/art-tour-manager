-- Update any existing email templates that use the old placeholder
UPDATE email_templates
SET content_template = REPLACE(content_template, 'booking_extra_requests', 'booking_notes_requests'),
    subject_template = REPLACE(subject_template, 'booking_extra_requests', 'booking_notes_requests'),
    updated_at = now()
WHERE content_template LIKE '%booking_extra_requests%' OR subject_template LIKE '%booking_extra_requests%';
