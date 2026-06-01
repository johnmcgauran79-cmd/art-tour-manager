UPDATE public.customers c
SET date_of_birth = sub.dob,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (customer_id) customer_id, date_of_birth AS dob
  FROM public.booking_travel_docs
  WHERE date_of_birth IS NOT NULL AND customer_id IS NOT NULL
  ORDER BY customer_id, updated_at DESC NULLS LAST
) sub
WHERE c.id = sub.customer_id
  AND c.date_of_birth IS NULL;