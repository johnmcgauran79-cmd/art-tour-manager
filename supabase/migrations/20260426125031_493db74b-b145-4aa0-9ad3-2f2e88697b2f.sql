UPDATE public.tasks
SET status = 'cancelled',
    completed_at = now()
WHERE id IN (
  SELECT t.id
  FROM public.tasks t
  JOIN public.tours tr ON t.tour_id = tr.id
  WHERE EXTRACT(YEAR FROM tr.start_date) = 2025
    AND t.status NOT IN ('completed', 'cancelled', 'archived', 'not_required')
);