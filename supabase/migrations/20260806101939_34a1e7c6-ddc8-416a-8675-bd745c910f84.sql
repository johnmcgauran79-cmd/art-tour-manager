CREATE TABLE IF NOT EXISTS public.personal_note_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_note_shares TO authenticated;
GRANT ALL ON public.personal_note_shares TO service_role;

ALTER TABLE public.personal_note_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_note_owner(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personal_notes n
    WHERE n.id = _note_id AND n.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_note_shared_with(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personal_note_shares s
    WHERE s.note_id = _note_id AND s.user_id = _user_id
  )
$$;

CREATE POLICY "Note owner manages shares"
ON public.personal_note_shares FOR ALL
TO authenticated
USING (public.is_note_owner(note_id, auth.uid()))
WITH CHECK (public.is_note_owner(note_id, auth.uid()));

CREATE POLICY "Users view note shares assigned to them"
ON public.personal_note_shares FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Shared users can view notes"
ON public.personal_notes FOR SELECT
TO authenticated
USING (public.is_note_shared_with(id, auth.uid()));

CREATE POLICY "Shared users can update notes"
ON public.personal_notes FOR UPDATE
TO authenticated
USING (public.is_note_shared_with(id, auth.uid()))
WITH CHECK (public.is_note_shared_with(id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_personal_note_shares_user ON public.personal_note_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_note_shares_note ON public.personal_note_shares(note_id);