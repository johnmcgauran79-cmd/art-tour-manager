ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS welcome_message_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_message_heading text,
  ADD COLUMN IF NOT EXISTS welcome_message_body text,
  ADD COLUMN IF NOT EXISTS welcome_message_signoff text,
  ADD COLUMN IF NOT EXISTS welcome_message_image_path text;