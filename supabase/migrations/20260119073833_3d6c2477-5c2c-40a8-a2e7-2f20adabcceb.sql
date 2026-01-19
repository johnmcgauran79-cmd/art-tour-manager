-- Add travel_documents_required field to tours table
ALTER TABLE public.tours 
ADD COLUMN travel_documents_required boolean NOT NULL DEFAULT false;