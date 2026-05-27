
UPDATE hotels SET default_check_in = '2026-11-23', default_check_out = '2026-11-26' WHERE id = '4e125a3b-aacd-477d-b077-248d2ec1fa8f';
UPDATE hotels SET default_check_in = '2026-11-26', default_check_out = '2026-11-30' WHERE id = '884a79b0-8d77-4abb-b386-eea1193c748b';

UPDATE activities SET activity_date = '2026-11-23' WHERE id = '30f91c25-f0db-4390-ae14-0c3727cc6a7d';
UPDATE activities SET activity_date = '2026-11-24' WHERE id = '6c5ca472-6af5-4815-98c4-59231beebba4';
UPDATE activities SET activity_date = '2026-11-25' WHERE id = 'eee76417-1a2f-4a24-a5f6-abecf6573904';
UPDATE activities SET activity_date = '2026-11-26' WHERE id = '89ed8b39-95e7-41a7-bb71-c0cabfa32232';
UPDATE activities SET activity_date = '2026-11-26' WHERE id = 'aa43c2df-4ca0-4f7d-81d2-7b98026ee7f4';
UPDATE activities SET activity_date = '2026-11-27' WHERE id = '159df6c0-fd5a-425e-bc81-a170164acb41';
UPDATE activities SET activity_date = '2026-11-29' WHERE id = '75e161c5-95ac-4f2f-b62f-bbcd4a99ef80';

ALTER TABLE hotel_bookings DISABLE TRIGGER USER;
ALTER TABLE activity_bookings DISABLE TRIGGER USER;
ALTER TABLE bookings DISABLE TRIGGER USER;

INSERT INTO hotel_bookings (booking_id, hotel_id, allocated, required, check_in_date, check_out_date, nights, bedding)
SELECT b.id, '4e125a3b-aacd-477d-b077-248d2ec1fa8f', true, true, '2026-11-23'::date, '2026-11-26'::date, 3, 'single'::bedding_type
FROM bookings b
WHERE b.tour_id = 'd0d82825-7136-49d8-9404-72b84a28c8b3' AND b.status != 'cancelled'
AND NOT EXISTS (SELECT 1 FROM hotel_bookings hb WHERE hb.booking_id = b.id AND hb.hotel_id = '4e125a3b-aacd-477d-b077-248d2ec1fa8f');

INSERT INTO hotel_bookings (booking_id, hotel_id, allocated, required, check_in_date, check_out_date, nights, bedding)
SELECT b.id, '884a79b0-8d77-4abb-b386-eea1193c748b', true, true, '2026-11-26'::date, '2026-11-30'::date, 4, 'single'::bedding_type
FROM bookings b
WHERE b.tour_id = 'd0d82825-7136-49d8-9404-72b84a28c8b3' AND b.status != 'cancelled'
AND NOT EXISTS (SELECT 1 FROM hotel_bookings hb WHERE hb.booking_id = b.id AND hb.hotel_id = '884a79b0-8d77-4abb-b386-eea1193c748b');

INSERT INTO activity_bookings (booking_id, activity_id, passengers_attending)
SELECT b.id, a.id, b.passenger_count
FROM bookings b
CROSS JOIN activities a
WHERE b.tour_id = 'd0d82825-7136-49d8-9404-72b84a28c8b3' AND b.status != 'cancelled'
AND a.tour_id = 'd0d82825-7136-49d8-9404-72b84a28c8b3'
AND NOT EXISTS (SELECT 1 FROM activity_bookings ab WHERE ab.booking_id = b.id AND ab.activity_id = a.id);

UPDATE bookings SET check_in_date = '2026-11-23', check_out_date = '2026-11-30', total_nights = 7
WHERE tour_id = 'd0d82825-7136-49d8-9404-72b84a28c8b3' AND status != 'cancelled';

ALTER TABLE hotel_bookings ENABLE TRIGGER USER;
ALTER TABLE activity_bookings ENABLE TRIGGER USER;
ALTER TABLE bookings ENABLE TRIGGER USER;
