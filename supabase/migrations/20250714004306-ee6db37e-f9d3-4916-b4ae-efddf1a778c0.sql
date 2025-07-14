-- Add url_reference column to tours table
ALTER TABLE public.tours 
ADD COLUMN url_reference TEXT;