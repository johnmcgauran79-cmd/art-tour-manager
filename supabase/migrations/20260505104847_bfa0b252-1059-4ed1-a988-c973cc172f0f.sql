
WITH corrections AS (
  SELECT el.id AS log_id,
         COALESCE(ael.email_template_id, r.email_template_id) AS correct_template_id,
         t.name AS correct_template_name
  FROM email_logs el
  JOIN automated_email_log ael
    ON el.tour_id = ael.tour_id
   AND el.sent_at BETWEEN ael.sent_at - interval '15 minutes'
                      AND ael.sent_at + interval '15 minutes'
  JOIN automated_email_rules r ON r.id = ael.rule_id
  JOIN email_templates t ON t.id = COALESCE(ael.email_template_id, r.email_template_id)
  WHERE el.template_id = '6a0493d8-df17-424b-a674-437d3149b9fd'
    AND COALESCE(ael.email_template_id, r.email_template_id) <> '6a0493d8-df17-424b-a674-437d3149b9fd'
)
UPDATE email_logs el
SET template_id = c.correct_template_id,
    template_name = c.correct_template_name
FROM corrections c
WHERE el.id = c.log_id;
