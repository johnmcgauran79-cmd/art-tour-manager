-- Mark the Karaka and Launceston 100-day email batches as sent to prevent retriggering
UPDATE automated_email_log 
SET approval_status = 'sent', 
    sent_at = now()
WHERE id IN (
  '91ee8be3-9ea1-4393-9964-b15f159cce5a',
  '0718308d-0833-4f68-8543-e5e07baf2236'
);