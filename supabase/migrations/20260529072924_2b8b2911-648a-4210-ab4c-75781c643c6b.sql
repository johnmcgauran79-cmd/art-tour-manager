
-- 1. Create + link contacts for the 6 real unlinked passenger 2 names
WITH c AS (INSERT INTO public.customers (first_name,last_name) VALUES ('Nicole','Mace') RETURNING id)
UPDATE public.bookings SET passenger_2_id = c.id, passenger_2_name = 'Nicole Mace'
FROM c WHERE bookings.id = 'e1f8d11c-c42b-4f99-9ad0-0d6e94677376';

WITH c AS (INSERT INTO public.customers (first_name,last_name) VALUES ('Jillian','Griggs') RETURNING id)
UPDATE public.bookings SET passenger_2_id = c.id, passenger_2_name = 'Jillian Griggs'
FROM c WHERE bookings.id = 'ca53962e-fdb9-48a4-8f75-04aa01bdc1b5';

WITH c AS (INSERT INTO public.customers (first_name,last_name) VALUES ('David','Hanratty') RETURNING id)
UPDATE public.bookings SET passenger_2_id = c.id, passenger_2_name = 'David Hanratty'
FROM c WHERE bookings.id = '5e2caeec-838c-4de4-be1e-80e343586075';

WITH c AS (INSERT INTO public.customers (first_name,last_name) VALUES ('Andrew','Turner') RETURNING id)
UPDATE public.bookings SET passenger_2_id = c.id, passenger_2_name = 'Andrew Turner'
FROM c WHERE bookings.id = '83fce124-5d5c-4ebc-9ad5-6dd9eee3386d';

WITH c AS (INSERT INTO public.customers (first_name,last_name) VALUES ('Jenny','Pashley') RETURNING id)
UPDATE public.bookings SET passenger_2_id = c.id, passenger_2_name = 'Jenny Pashley'
FROM c WHERE bookings.id = '8099ec69-54d9-4e8a-a026-7bc5ad6f6fe8';

WITH c AS (INSERT INTO public.customers (first_name,last_name) VALUES ('Susanne','Peters') RETURNING id)
UPDATE public.bookings SET passenger_2_id = c.id, passenger_2_name = 'Susanne Peters'
FROM c WHERE bookings.id = '4fdc46cd-bb79-444d-9937-d09ab8f750f7';

-- 2. Sync stored passenger 2 name to the linked contact where they genuinely mismatch
UPDATE public.bookings b
SET passenger_2_name = c.first_name || ' ' || c.last_name
FROM public.customers c
WHERE b.passenger_2_id = c.id
  AND b.passenger_2_name IS NOT NULL AND btrim(b.passenger_2_name) <> ''
  AND lower(btrim(c.last_name)) <> 'unknown'
  AND lower(btrim(c.first_name || ' ' || c.last_name)) <> 'tbc'
  AND lower(btrim(b.passenger_2_name)) <> lower(btrim(c.first_name || ' ' || c.last_name));

-- 3. Same sync for passenger 3
UPDATE public.bookings b
SET passenger_3_name = c.first_name || ' ' || c.last_name
FROM public.customers c
WHERE b.passenger_3_id = c.id
  AND b.passenger_3_name IS NOT NULL AND btrim(b.passenger_3_name) <> ''
  AND lower(btrim(c.last_name)) <> 'unknown'
  AND lower(btrim(c.first_name || ' ' || c.last_name)) <> 'tbc'
  AND lower(btrim(b.passenger_3_name)) <> lower(btrim(c.first_name || ' ' || c.last_name));
