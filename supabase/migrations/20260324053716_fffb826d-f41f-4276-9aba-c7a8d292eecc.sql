ALTER TABLE public.tour_additional_info_sections 
ADD COLUMN include_in_email_rules text[] NOT NULL DEFAULT '{}';