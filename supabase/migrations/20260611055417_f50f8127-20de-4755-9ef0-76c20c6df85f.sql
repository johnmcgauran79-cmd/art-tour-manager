CREATE TABLE public.staff_leave (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_leave TO authenticated;
GRANT ALL ON public.staff_leave TO service_role;

ALTER TABLE public.staff_leave ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view staff leave"
  ON public.staff_leave FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add their own leave or admins add for anyone"
  ON public.staff_leave FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own leave or admins update any"
  ON public.staff_leave FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own leave or admins delete any"
  ON public.staff_leave FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_staff_leave_updated_at
  BEFORE UPDATE ON public.staff_leave
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();