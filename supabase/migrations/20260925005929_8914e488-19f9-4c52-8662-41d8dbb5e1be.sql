ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS race_tickets_arranged_at timestamptz,
  ADD COLUMN IF NOT EXISTS race_tickets_arranged_by uuid,
  ADD COLUMN IF NOT EXISTS whatsapp_group_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_group_started_by uuid;