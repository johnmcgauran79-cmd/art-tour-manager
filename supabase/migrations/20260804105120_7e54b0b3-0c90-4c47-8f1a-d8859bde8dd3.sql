ALTER TABLE public.tour_additional_info_sections
ADD COLUMN IF NOT EXISTS include_in_guest_document boolean NOT NULL DEFAULT true;