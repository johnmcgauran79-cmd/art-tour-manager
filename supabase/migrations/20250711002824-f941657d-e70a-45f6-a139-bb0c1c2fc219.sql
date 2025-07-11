-- Add URL reference field to tasks table
ALTER TABLE public.tasks 
ADD COLUMN url_reference TEXT;