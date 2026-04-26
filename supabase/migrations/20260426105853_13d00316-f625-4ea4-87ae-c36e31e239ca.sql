ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'not_required';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'with_third_party';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'awaiting_further_information';