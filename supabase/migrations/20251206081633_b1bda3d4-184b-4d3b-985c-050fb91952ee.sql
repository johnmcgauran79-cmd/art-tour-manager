
-- Delete old rejected entry and create fresh pending approval for Dummy tour 100-day confirmation
DELETE FROM automated_email_log WHERE id = 'bf7ce8e7-88c4-4d78-8c29-5c69574aaacb';

INSERT INTO automated_email_log (
  rule_id,
  tour_id,
  tour_start_date,
  days_before_send,
  booking_count,
  approval_status,
  sent_at
) VALUES (
  '692c1e89-8144-4d71-b621-ec9264cf904c',
  '48037c4f-59af-43f4-91c6-d5184adff49f',
  '2026-02-01',
  100,
  2,
  'pending_approval',
  NOW()
);
