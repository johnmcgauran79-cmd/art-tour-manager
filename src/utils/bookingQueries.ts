/**
 * Standardized booking query fragments to handle multiple customer relationships
 * (lead_passenger_id, secondary_contact_id, passenger_2_id, passenger_3_id)
 */

export const BOOKING_SELECT_WITH_CUSTOMERS = `
  *,
  tours (name),
  customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements, preferred_name, avatar_url),
  secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
  passenger_2:customers!passenger_2_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name),
  passenger_3:customers!passenger_3_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name)
`;

export const BOOKING_SELECT_WITH_RELATIONS = `
  *,
  tours (name),
  customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name, avatar_url),
  secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
  passenger_2:customers!passenger_2_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name),
  passenger_3:customers!passenger_3_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name),
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
