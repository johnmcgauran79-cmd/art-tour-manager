DELETE FROM public.task_watchers 
WHERE user_id IN ('76608e17-b319-4947-9db3-5a17f97c9a4b','71a83bf9-5360-44f0-99b5-3521d134dbfd')
AND task_id IN (SELECT id FROM public.tasks WHERE category = 'operations');