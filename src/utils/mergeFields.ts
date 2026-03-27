// Shared merge field definitions used by EmailTemplatesManagement and CustomCardBuilderModal

export const MERGE_FIELDS: Record<string, string[]> = {
  customer: [
    '{{customer_first_name}}', '{{customer_last_name}}', '{{customer_preferred_name}}', '{{customer_email}}', '{{customer_phone}}',
    '{{customer_city}}', '{{customer_state}}', '{{customer_country}}', '{{customer_spouse_name}}',
    '{{customer_dietary_requirements}}', '{{customer_medical_conditions}}', '{{customer_accessibility_needs}}',
    '{{customer_emergency_contact_name}}', '{{customer_emergency_contact_phone}}', '{{customer_emergency_contact_relationship}}', '{{customer_emergency_contact_email}}',
    '{{customer_notes}}'
  ],
  lead_passenger: [
    '{{lead_passenger_first_name}}', '{{lead_passenger_last_name}}', '{{lead_passenger_preferred_name}}', 
    '{{lead_passenger_email}}', '{{lead_passenger_phone}}',
    '{{lead_passenger_city}}', '{{lead_passenger_state}}', '{{lead_passenger_country}}', '{{lead_passenger_spouse_name}}',
    '{{lead_passenger_dietary_requirements}}', '{{lead_passenger_medical_conditions}}', '{{lead_passenger_accessibility_needs}}',
    '{{lead_passenger_emergency_contact_name}}', '{{lead_passenger_emergency_contact_phone}}', '{{lead_passenger_emergency_contact_relationship}}', '{{lead_passenger_emergency_contact_email}}'
  ],
  passenger_2: [
    '{{passenger_2_first_name}}', '{{passenger_2_last_name}}', '{{passenger_2_preferred_name}}', 
    '{{passenger_2_email}}', '{{passenger_2_phone}}',
    '{{passenger_2_dietary_requirements}}', '{{passenger_2_medical_conditions}}', '{{passenger_2_accessibility_needs}}',
    '{{passenger_2_emergency_contact_name}}', '{{passenger_2_emergency_contact_phone}}', '{{passenger_2_emergency_contact_relationship}}', '{{passenger_2_emergency_contact_email}}'
  ],
  passenger_3: [
    '{{passenger_3_first_name}}', '{{passenger_3_last_name}}', '{{passenger_3_preferred_name}}', 
    '{{passenger_3_email}}', '{{passenger_3_phone}}',
    '{{passenger_3_dietary_requirements}}', '{{passenger_3_medical_conditions}}', '{{passenger_3_accessibility_needs}}',
    '{{passenger_3_emergency_contact_name}}', '{{passenger_3_emergency_contact_phone}}', '{{passenger_3_emergency_contact_relationship}}', '{{passenger_3_emergency_contact_email}}'
  ],
  tour: [
    '{{tour_name}}', '{{tour_location}}', '{{tour_type}}', '{{tour_start_date}}', '{{tour_end_date}}',
    '{{tour_days}}', '{{tour_nights}}', '{{tour_pickup_point}}', '{{tour_host}}',
    '{{tour_capacity}}', '{{tour_minimum_passengers}}',
    '{{tour_price_single}}', '{{tour_price_double}}', '{{tour_price_twin}}', '{{tour_deposit_required}}',
    '{{tour_final_payment_date}}', '{{tour_instalment_date}}', '{{tour_instalment_amount}}', '{{tour_instalment_details}}',
    '{{tour_inclusions}}', '{{tour_exclusions}}', '{{tour_travel_documents_required}}'
  ],
  booking: [
    '{{booking_passenger_count}}', '{{booking_status}}', '{{booking_check_in_date}}', '{{booking_check_out_date}}',
    '{{booking_total_nights}}', '{{booking_passenger_2_name}}', '{{booking_passenger_3_name}}',
    '{{booking_group_name}}', '{{booking_booking_agent}}', '{{booking_notes_requests}}', '{{booking_invoice_notes}}',
    '{{booking_passport_number}}', '{{booking_passport_country}}', '{{booking_passport_expiry_date}}',
    '{{booking_nationality}}', '{{booking_revenue}}',
    '{{booking_accommodation_required}}', '{{booking_whatsapp_group_comms}}'
  ],
  hotel: [
    '{{#hotel_bookings}}', '{{hotel_name}}', '{{hotel_check_in_date}}', '{{hotel_check_out_date}}',
    '{{hotel_nights}}', '{{hotel_room_type}}', '{{hotel_bedding}}', '{{hotel_room_upgrade}}',
    '{{hotel_room_requests}}', '{{hotel_confirmation_number}}', '{{hotel_address}}',
    '{{hotel_contact_name}}', '{{hotel_contact_phone}}', '{{hotel_contact_email}}', '{{hotel_extra_night_price}}', '{{/hotel_bookings}}'
  ],
  activity: [
    '{{#activity_bookings}}', '{{activity_name}}', '{{activity_date}}', '{{activity_status}}',
    '{{activity_start_time}}', '{{activity_end_time}}', '{{activity_location}}',
    '{{activity_pickup_time}}', '{{activity_pickup_location}}', 
    '{{activity_collection_time}}', '{{activity_collection_location}}', '{{activity_dropoff_location}}',
    '{{activity_depart_for_activity}}', '{{activity_transport_mode}}',
    '{{activity_driver_name}}', '{{activity_driver_phone}}',
    '{{activity_transport_company}}', '{{activity_transport_contact_name}}', 
    '{{activity_transport_phone}}', '{{activity_transport_email}}',
    '{{activity_contact_name}}', '{{activity_contact_phone}}', '{{activity_contact_email}}',
    '{{activity_hospitality_inclusions}}', '{{activity_notes}}',
    '{{activity_spots_available}}', '{{activity_spots_booked}}',
    '{{passengers_attending}}', '{{/activity_bookings}}'
  ],
  actions: [
    '{{profile_update_button}}', '{{profile_update_link}}',
    '{{travel_docs_button}}', '{{travel_docs_link}}',
    '{{waiver_button}}', '{{waiver_link}}',
    '{{pickup_button}}', '{{pickup_link}}',
    '{{itinerary_button}}', '{{itinerary_link}}',
    '--- Tour Content ---',
    '{{additional_info_blocks}}',
    '{{hotel_details}}',
    '--- Smart Cards ---',
    '{{tour_details_card}}',
    '{{passenger_info_card}}'
  ],
  conditions: [
    '--- Passenger Conditions ---',
    '{{#has_passenger_2}} ... {{/has_passenger_2}}',
    '{{^has_passenger_2}} ... {{/has_passenger_2}}',
    '{{#has_passenger_3}} ... {{/has_passenger_3}}',
    '{{#has_multiple_passengers}} ... {{/has_multiple_passengers}}',
    '{{#passenger_2_has_email}} ... {{/passenger_2_has_email}}',
    '{{#passenger_2_missing_email}} ... {{/passenger_2_missing_email}}',
    '{{#passenger_3_has_email}} ... {{/passenger_3_has_email}}',
    '{{#passenger_3_missing_email}} ... {{/passenger_3_missing_email}}',
    '{{#passenger_2_has_phone}} ... {{/passenger_2_has_phone}}',
    '{{#passenger_2_missing_phone}} ... {{/passenger_2_missing_phone}}',
    '{{#passenger_3_has_phone}} ... {{/passenger_3_has_phone}}',
    '{{#passenger_3_missing_phone}} ... {{/passenger_3_missing_phone}}',
    '--- Booking Conditions ---',
    '{{#has_accommodation}} ... {{/has_accommodation}}',
    '{{^has_accommodation}} ... {{/has_accommodation}}',
    '{{#has_hotel_bookings}} ... {{/has_hotel_bookings}}',
    '{{#has_hotel_extra_night_price}} ... {{/has_hotel_extra_night_price}}',
    '{{^has_hotel_extra_night_price}} ... {{/has_hotel_extra_night_price}}',
    '{{#has_hotel_room_type}} ... {{/has_hotel_room_type}}',
    '{{^has_hotel_room_type}} ... {{/has_hotel_room_type}}',
    '{{#has_activity_bookings}} ... {{/has_activity_bookings}}',
    '{{#has_group_name}} ... {{/has_group_name}}',
    '{{#has_extra_requests}} ... {{/has_extra_requests}}',
    '--- Tour Conditions ---',
    '{{#tour_requires_travel_docs}} ... {{/tour_requires_travel_docs}}',
    '{{^tour_requires_travel_docs}} ... {{/tour_requires_travel_docs}}',
    '{{#tour_requires_pickup}} ... {{/tour_requires_pickup}}',
    '{{#has_instalment}} ... {{/has_instalment}}',
    '{{^has_instalment}} ... {{/has_instalment}}',
    '--- Passport Conditions ---',
    '{{#has_passport_details}} ... {{/has_passport_details}}',
    '{{^has_passport_details}} ... {{/has_passport_details}}',
    '{{#needs_passport_submission}} ... {{/needs_passport_submission}}',
    '--- Pickup Conditions ---',
    '{{#has_pickup_selection}} ... {{/has_pickup_selection}}',
    '{{#missing_pickup_selection}} ... {{/missing_pickup_selection}}',
    '--- Waiver Conditions ---',
    '{{#waiver_not_signed}} ... {{/waiver_not_signed}}',
    '{{^waiver_not_signed}} ... {{/waiver_not_signed}}',
  ]
};

// Extract just the condition key from a condition string like "{{#has_passenger_2}} ... {{/has_passenger_2}}"
export function parseConditionKey(conditionStr: string): { key: string; negate: boolean } | null {
  const match = conditionStr.match(/\{\{([#^])(\w+)\}\}/);
  if (!match) return null;
  return { key: match[2], negate: match[1] === '^' };
}

// Get a flat list of condition options for use in selects (no section headers)
export function getConditionOptions(): { value: string; label: string }[] {
  return MERGE_FIELDS.conditions
    .filter(f => !f.startsWith('---'))
    .map(f => {
      const parsed = parseConditionKey(f);
      if (!parsed) return null;
      const prefix = parsed.negate ? 'If NOT ' : 'If ';
      const label = prefix + parsed.key.replace(/_/g, ' ');
      const value = `${parsed.negate ? '^' : '#'}${parsed.key}`;
      return { value, label };
    })
    .filter(Boolean) as { value: string; label: string }[];
}

// Category labels for the merge field tabs
export const MERGE_FIELD_CATEGORIES: Record<string, string> = {
  customer: 'Recipient',
  lead_passenger: 'Lead Pax',
  passenger_2: 'Pax 2',
  passenger_3: 'Pax 3',
  tour: 'Tour',
  booking: 'Booking',
  hotel: 'Hotel',
  activity: 'Activity',
  actions: 'Actions',
  conditions: 'Conditions',
};
