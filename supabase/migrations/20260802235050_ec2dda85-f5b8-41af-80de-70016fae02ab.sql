UPDATE email_templates
SET content_template = replace(content_template, '${{', '{{currency_symbol}}{{')
WHERE type = 'payment_receipt'
  AND content_template LIKE '%${{%';