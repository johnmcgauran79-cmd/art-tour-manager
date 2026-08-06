ALTER TABLE public.personal_todos
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS converted_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.personal_todo_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id uuid NOT NULL REFERENCES public.personal_todos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (todo_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_todo_shares TO authenticated;
GRANT ALL ON public.personal_todo_shares TO service_role;

ALTER TABLE public.personal_todo_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_todo_owner(_todo_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personal_todos t
    WHERE t.id = _todo_id AND t.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_todo_shared_with(_todo_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personal_todo_shares s
    WHERE s.todo_id = _todo_id AND s.user_id = _user_id
  )
$$;

CREATE POLICY "Todo owner manages shares"
ON public.personal_todo_shares FOR ALL
TO authenticated
USING (public.is_todo_owner(todo_id, auth.uid()))
WITH CHECK (public.is_todo_owner(todo_id, auth.uid()));

CREATE POLICY "Users view shares assigned to them"
ON public.personal_todo_shares FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Shared users can view todos"
ON public.personal_todos FOR SELECT
TO authenticated
USING (public.is_todo_shared_with(id, auth.uid()));

CREATE POLICY "Shared users can update todos"
ON public.personal_todos FOR UPDATE
TO authenticated
USING (public.is_todo_shared_with(id, auth.uid()))
WITH CHECK (public.is_todo_shared_with(id, auth.uid()));