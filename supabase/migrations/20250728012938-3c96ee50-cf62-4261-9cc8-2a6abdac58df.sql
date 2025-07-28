-- Update the RLS policy to only allow users to see their own notifications
-- Remove the department-based access since we now create individual notifications

DROP POLICY IF EXISTS "Users can view relevant notifications" ON user_notifications;

CREATE POLICY "Users can view their own notifications" 
ON user_notifications 
FOR SELECT 
USING (auth.uid() = user_id);