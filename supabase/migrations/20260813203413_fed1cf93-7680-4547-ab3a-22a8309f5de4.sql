ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS pickup_arrival_message TEXT,
  ADD COLUMN IF NOT EXISTS welcome_drinks_message TEXT;