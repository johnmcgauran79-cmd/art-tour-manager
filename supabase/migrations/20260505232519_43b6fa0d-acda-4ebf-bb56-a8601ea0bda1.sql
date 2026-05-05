WITH groups AS (
  SELECT tour_id, template_id, date_trunc('hour', sent_at) + (floor(date_part('minute', sent_at)/10) * interval '10 minutes') AS bucket
  FROM email_logs
  WHERE batch_id IS NULL
    AND tour_id IS NOT NULL
    AND template_id IS NOT NULL
  GROUP BY 1,2,3
  HAVING count(*) >= 2
),
assigned AS (
  SELECT g.*, gen_random_uuid() AS new_batch_id FROM groups g
)
UPDATE email_logs el
SET batch_id = a.new_batch_id
FROM assigned a
WHERE el.batch_id IS NULL
  AND el.tour_id = a.tour_id
  AND el.template_id = a.template_id
  AND el.sent_at >= a.bucket
  AND el.sent_at < a.bucket + interval '10 minutes';