
-- Create a table to track which users have dismissed which notifications
CREATE TABLE public.user_notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES public.user_notifications(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_id)
);

-- Add Row Level Security
ALTER TABLE public.user_notification_dismissals ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to manage their own dismissals
CREATE POLICY "Users can view their own dismissals" 
  ON public.user_notification_dismissals 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dismissals" 
  ON public.user_notification_dismissals 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissals" 
  ON public.user_notification_dismissals 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create an index for better performance
CREATE INDEX idx_user_notification_dismissals_user_notification ON public.user_notification_dismissals(user_id, notification_id);
