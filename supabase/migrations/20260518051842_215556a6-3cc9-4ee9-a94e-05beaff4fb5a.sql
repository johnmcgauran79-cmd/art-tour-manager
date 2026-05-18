
-- Add new task status enum values used by the new task statuses table
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'approval_required';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'changes_needed';
