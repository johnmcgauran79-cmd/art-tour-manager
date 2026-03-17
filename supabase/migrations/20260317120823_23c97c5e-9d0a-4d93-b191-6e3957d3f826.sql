
-- Add email_template_id override to status_change_email_queue
-- When set, this overrides the rule's template AND any tour-level override
ALTER TABLE public.status_change_email_queue 
ADD COLUMN email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;

-- Add email_template_id override to automated_email_log
ALTER TABLE public.automated_email_log 
ADD COLUMN email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;
