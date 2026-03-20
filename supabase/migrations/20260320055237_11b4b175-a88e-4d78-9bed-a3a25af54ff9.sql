
-- Restore Nathan Pashley's contact record (was overwritten to Simon Merritt by the bug)
UPDATE customers 
SET first_name = 'Nathan', last_name = 'Pashley' 
WHERE id = 'd8e2f8df-e3eb-4a76-b855-62b9bc3758be';

-- Re-link Royal Ascot booking to the REAL Simon Merritt contact
UPDATE bookings 
SET lead_passenger_id = '091d1d3b-97bf-402c-80b7-703534503567' 
WHERE id = '57605e51-c7e4-40d5-9c1a-8cfa3bc3b220';

-- Kangaroo Island booking stays linked to Nathan Pashley (d8e2f8df) - no change needed
