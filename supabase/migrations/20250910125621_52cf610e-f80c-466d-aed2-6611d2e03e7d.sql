-- Add from_email field to email_templates table
ALTER TABLE public.email_templates 
ADD COLUMN from_email text NOT NULL DEFAULT 'info@australianracingtours.com.au';