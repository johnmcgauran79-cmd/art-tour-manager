ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preference text NOT NULL DEFAULT 'teams',
  ADD COLUMN IF NOT EXISTS teams_user_id text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_notification_preference_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_notification_preference_check
  CHECK (notification_preference IN ('email', 'teams', 'both'));