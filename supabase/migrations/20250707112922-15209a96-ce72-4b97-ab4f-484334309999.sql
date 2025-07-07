
-- Update RLS policies for user_notifications to allow creating notifications for other users and departments

-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "System can create notifications" ON public.user_notifications;

-- Create a more permissive policy that allows authenticated users to create notifications
-- This is needed for the notification system to work across users and departments
CREATE POLICY "Authenticated users can create notifications" ON public.user_notifications
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also allow users to view department notifications they have access to
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.user_notifications;

CREATE POLICY "Users can view relevant notifications" ON public.user_notifications
  FOR SELECT 
  USING (
    -- User's own notifications
    auth.uid() = user_id OR 
    -- Department notifications for departments the user belongs to
    (user_id IS NULL AND department IS NOT NULL AND user_has_department(auth.uid(), department)) OR
    -- General notifications (no user_id and no department)
    (user_id IS NULL AND department IS NULL)
  );
