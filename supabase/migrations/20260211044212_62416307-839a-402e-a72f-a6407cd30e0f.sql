
-- Clean up incorrectly queued items that don't match the rule's conditions
DELETE FROM status_change_email_queue 
WHERE approval_status = 'pending'
AND new_status NOT IN ('deposited', 'rb_invoiced');
