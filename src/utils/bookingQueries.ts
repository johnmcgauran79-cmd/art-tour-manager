/**
 * Standardized booking query fragments to handle multiple customer relationships
 * (lead_passenger_id and secondary_contact_id)
 */

export const BOOKING_SELECT_WITH_CUSTOMERS = `
  *,
  tours (name),
  customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
  secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
`;

export const BOOKING_SELECT_WITH_RELATIONS = `
  *,
  tours (name),
  customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
  secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
  hotel_bookings (
    id,
    hotel_id,
    check_in_date,
    check_out_date,
    nights,
    bedding,
    allocated,
    room_type,
    room_upgrade,
    confirmation_number,
    room_requests,
    hotels (name)
  ),
  activity_bookings (
    id,
    activity_id,
    passengers_attending,
    activities (name)
  )
`;
