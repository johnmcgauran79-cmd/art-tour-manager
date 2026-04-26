-- Enhance task_subtasks with lightweight task-like fields
ALTER TABLE public.task_subtasks
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS latest_note text,
  ADD COLUMN IF NOT EXISTS latest_note_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_note_by uuid;

CREATE INDEX IF NOT EXISTS idx_task_subtasks_assignee_id ON public.task_subtasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_due_date ON public.task_subtasks(due_date);