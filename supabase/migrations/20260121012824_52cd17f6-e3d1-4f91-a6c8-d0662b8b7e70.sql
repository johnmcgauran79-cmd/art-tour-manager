-- Rename guide columns to contact columns in activities table
ALTER TABLE public.activities RENAME COLUMN guide_name TO contact_name;
ALTER TABLE public.activities RENAME COLUMN guide_phone TO contact_phone;
ALTER TABLE public.activities RENAME COLUMN guide_email TO contact_email;