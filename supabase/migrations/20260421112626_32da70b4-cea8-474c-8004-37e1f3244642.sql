-- Fix search_path security warnings on new task management functions
-- This prevents search_path manipulation attacks

ALTER FUNCTION public.log_task_activity(uuid, text, jsonb, jsonb, text) SET search_path = public;

ALTER FUNCTION public.tasks_log_changes() SET search_path = public;

ALTER FUNCTION public.task_assignments_log() SET search_path = public;

ALTER FUNCTION public.task_comments_log() SET search_path = public;

ALTER FUNCTION public.task_attachments_log() SET search_path = public;

ALTER FUNCTION public.task_subtasks_log() SET search_path = public;