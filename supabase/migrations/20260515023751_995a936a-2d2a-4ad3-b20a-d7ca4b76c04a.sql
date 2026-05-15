
-- Remove non-allowed assignees from operations-category tasks
DELETE FROM public.task_assignments ta
USING public.tasks t
WHERE ta.task_id = t.id
  AND t.category = 'operations'
  AND ta.user_id NOT IN (
    '1ea92f6f-f7a6-4ecb-9b23-c137c2871f17', -- Belinda Osborne
    '4e41ca5c-dbb9-45ab-847f-0c185e780a70', -- John McGauran
    'c8efb2b6-e7ef-4485-9aad-f6e12348cbac'  -- Tara Millena
  );

-- Assign John to any operations task that now has no assignees
INSERT INTO public.task_assignments (task_id, user_id, assigned_by)
SELECT t.id,
       '4e41ca5c-dbb9-45ab-847f-0c185e780a70'::uuid,
       '4e41ca5c-dbb9-45ab-847f-0c185e780a70'::uuid
FROM public.tasks t
WHERE t.category = 'operations'
  AND NOT EXISTS (
    SELECT 1 FROM public.task_assignments ta WHERE ta.task_id = t.id
  );
