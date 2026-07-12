ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS skill_id text,
  ADD COLUMN IF NOT EXISTS entry_point text,
  ADD COLUMN IF NOT EXISTS source_page text,
  ADD COLUMN IF NOT EXISTS success boolean,
  ADD COLUMN IF NOT EXISTS tools_used text[];