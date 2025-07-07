
-- Allow user_id to be nullable in user_notifications table
-- This is needed for department notifications and general notifications that aren't targeted to specific users
ALTER TABLE public.user_notifications 
ALTER COLUMN user_id DROP NOT NULL;
