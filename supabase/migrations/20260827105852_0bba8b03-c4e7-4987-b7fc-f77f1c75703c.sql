-- Normalise suppression rows that were stored as "Display Name <addr@x.com>"
WITH bad AS (
  SELECT id, lower(btrim(substring(email_address from '<([^>]+)>'))) AS clean
  FROM public.email_suppressions
  WHERE email_address LIKE '%<%>%'
),
dupes AS (
  DELETE FROM public.email_suppressions s
  USING bad b
  WHERE s.id = b.id
    AND EXISTS (SELECT 1 FROM public.email_suppressions e WHERE e.email_address = b.clean)
  RETURNING s.id
)
UPDATE public.email_suppressions s
SET email_address = b.clean
FROM bad b
WHERE s.id = b.id AND s.id NOT IN (SELECT id FROM dupes);