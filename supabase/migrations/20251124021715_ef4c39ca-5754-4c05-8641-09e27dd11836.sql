-- Add approval fields to automated_email_log
ALTER TABLE automated_email_log 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval', 'approved', 'rejected', 'sent')),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add index for faster querying of pending approvals
CREATE INDEX IF NOT EXISTS idx_automated_email_log_approval_status 
ON automated_email_log(approval_status) WHERE approval_status = 'pending_approval';

-- Update RLS policies to allow admins/managers to update approval status
DROP POLICY IF EXISTS "Admins can manage automated email log" ON automated_email_log;

CREATE POLICY "Admins and managers can view automated email log"
ON automated_email_log
FOR SELECT
TO authenticated
USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update approval status"
ON automated_email_log
FOR UPDATE
TO authenticated
USING (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'admin') OR check_user_role(auth.uid(), 'manager'));