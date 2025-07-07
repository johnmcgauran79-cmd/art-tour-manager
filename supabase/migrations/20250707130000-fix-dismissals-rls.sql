
-- Fix RLS policies for user_notification_dismissals table

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their own dismissals" ON public.user_notification_dismissals;
DROP POLICY IF EXISTS "Users can create their own dismissals" ON public.user_notification_dismissals;
DROP POLICY IF EXISTS "Users can delete their own dismissals" ON public.user_notification_dismissals;

-- Recreate policies with proper logic
CREATE POLICY "Users can view their own dismissals" 
  ON public.user_notification_dismissals 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dismissals" 
  ON public.user_notification_dismissals 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dismissals" 
  ON public.user_notification_dismissals 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissals" 
  ON public.user_notification_dismissals 
  FOR DELETE 
  USING (auth.uid() = user_id);
