// Email template engine with comprehensive mail merge fields
export interface EmailMergeData {
  // Customer fields (dynamic - changes per recipient for multi-passenger emails)
  customer_first_name?: string;
  customer_last_name?: string;
  customer_preferred_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_city?: string;
  customer_state?: string;
  customer_country?: string;
  customer_spouse_name?: string;
  customer_dietary_requirements?: string;
  customer_medical_conditions?: string;
  customer_accessibility_needs?: string;
  customer_emergency_contact_name?: string;
  customer_emergency_contact_phone?: string;
  customer_emergency_contact_relationship?: string;
  customer_emergency_contact_email?: string;
  customer_notes?: string;

  // Lead passenger fields (static - always the lead passenger regardless of recipient)
  lead_passenger_first_name?: string;
  lead_passenger_last_name?: string;
  lead_passenger_preferred_name?: string;
  lead_passenger_email?: string;
  lead_passenger_phone?: string;
  lead_passenger_city?: string;
  lead_passenger_state?: string;
  lead_passenger_country?: string;
  lead_passenger_spouse_name?: string;
  lead_passenger_dietary_requirements?: string;
  lead_passenger_medical_conditions?: string;
  lead_passenger_accessibility_needs?: string;
  lead_passenger_emergency_contact_name?: string;
  lead_passenger_emergency_contact_phone?: string;
  lead_passenger_emergency_contact_relationship?: string;
  lead_passenger_emergency_contact_email?: string;

  // Nested objects for dot-notation templates (backwards compatibility)
  customer?: {
    first_name?: string;
    last_name?: string;
    preferred_name?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
    spouse_name?: string;
    dietary_requirements?: string;
    medical_conditions?: string;
    accessibility_needs?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    emergency_contact_email?: string;
    notes?: string;
  };
  
  // Tour fields
  tour_name?: string;
  tour_location?: string;
  tour_type?: string;
  tour_start_date?: string;
  tour_end_date?: string;
  tour_days?: number;
  tour_nights?: number;
  tour_pickup_point?: string;
  tour_notes?: string;
  tour_inclusions?: string;
  tour_exclusions?: string;
  tour_host?: string;
  tour_capacity?: number;
  tour_minimum_passengers?: number;
  tour_price_single?: number;
  tour_price_double?: number;
  tour_price_twin?: number;
  tour_deposit_required?: number;
  tour_final_payment_date?: string;
  tour_instalment_date?: string;
  tour_instalment_amount?: number;
  tour_instalment_details?: string;
  tour_travel_documents_required?: boolean;
  
  // Booking fields
  booking_passenger_count?: number;
  booking_status?: string;
  booking_check_in_date?: string;
  booking_check_out_date?: string;
  booking_total_nights?: number;
  booking_passenger_2_name?: string;
  booking_passenger_3_name?: string;
  booking_group_name?: string;
  booking_booking_agent?: string;
  booking_notes_requests?: string;
  booking_invoice_notes?: string;
  booking_passport_number?: string;
  booking_passport_country?: string;
  booking_passport_expiry_date?: string;
  booking_nationality?: string;
  booking_revenue?: number;
  booking_accommodation_required?: boolean;
  booking_whatsapp_group_comms?: boolean;

  // Passenger 2 fields (static - always passenger 2)
  passenger_2_first_name?: string;
  passenger_2_last_name?: string;
  passenger_2_preferred_name?: string;
  passenger_2_email?: string;
  passenger_2_phone?: string;
  passenger_2_dietary_requirements?: string;
  passenger_2_medical_conditions?: string;
  passenger_2_accessibility_needs?: string;
  passenger_2_emergency_contact_name?: string;
  passenger_2_emergency_contact_phone?: string;
  passenger_2_emergency_contact_relationship?: string;
  passenger_2_emergency_contact_email?: string;

  // Passenger 3 fields (static - always passenger 3)
  passenger_3_first_name?: string;
  passenger_3_last_name?: string;
  passenger_3_preferred_name?: string;
  passenger_3_email?: string;
  passenger_3_phone?: string;
  passenger_3_dietary_requirements?: string;
  passenger_3_medical_conditions?: string;
  passenger_3_accessibility_needs?: string;
  passenger_3_emergency_contact_name?: string;
  passenger_3_emergency_contact_phone?: string;
  passenger_3_emergency_contact_relationship?: string;
  passenger_3_emergency_contact_email?: string;

  // Travel document fields (dynamic - changes per recipient for multi-passenger emails)
  passport_first_name?: string;
  passport_middle_name?: string;
  passport_surname?: string;
  passport_number?: string;
  passport_country?: string;
  passport_expiry_date?: string;
  date_of_birth?: string;
  nationality?: string;
  name_as_per_passport?: string;
  has_passport_details?: boolean;

  // Lead passenger travel docs (static reference)
  lead_passport_first_name?: string;
  lead_passport_middle_name?: string;
  lead_passport_surname?: string;
  lead_passport_number?: string;
  lead_passport_country?: string;
  lead_passport_expiry_date?: string;
  lead_date_of_birth?: string;
  lead_nationality?: string;

  // Passenger 2 travel docs (static reference)
  pax2_passport_first_name?: string;
  pax2_passport_middle_name?: string;
  pax2_passport_surname?: string;
  pax2_passport_number?: string;
  pax2_passport_country?: string;
  pax2_passport_expiry_date?: string;
  pax2_date_of_birth?: string;
  pax2_nationality?: string;

  // Passenger 3 travel docs (static reference)
  pax3_passport_first_name?: string;
  pax3_passport_middle_name?: string;
  pax3_passport_surname?: string;
  pax3_passport_number?: string;
  pax3_passport_country?: string;
  pax3_passport_expiry_date?: string;
  pax3_date_of_birth?: string;
  pax3_nationality?: string;

  booking?: {
    passenger_count?: number;
    status?: string;
    check_in_date?: string;
    check_out_date?: string;
    total_nights?: number;
    passenger_2_name?: string;
    passenger_3_name?: string;
    group_name?: string;
    booking_agent?: string;
    extra_requests?: string;
    invoice_notes?: string;
    passport_number?: string;
    passport_country?: string;
    passport_expiry_date?: string;
    nationality?: string;
    revenue?: number;
    accommodation_required?: boolean;
    whatsapp_group_comms?: boolean;
  };

  tour?: {
    name?: string;
    location?: string;
    tour_type?: string;
    start_date?: string;
    end_date?: string;
    days?: number;
    nights?: number;
    pickup_point?: string;
    notes?: string;
    inclusions?: string;
    exclusions?: string;
    tour_host?: string;
    capacity?: number;
    minimum_passengers_required?: number;
    price_single?: number;
    price_double?: number;
    price_twin?: number;
    deposit_required?: number;
    final_payment_date?: string;
    instalment_date?: string;
    instalment_amount?: number;
    instalment_details?: string;
    travel_documents_required?: boolean;
  };
  
  // Hotel booking fields (for multiple hotels, will be handled as arrays)
  hotel_bookings?: Array<{
    hotel_name?: string;
    hotel_check_in_date?: string;
    hotel_check_out_date?: string;
    hotel_nights?: number;
    hotel_room_type?: string;
    hotel_bedding?: string;
    hotel_room_upgrade?: string;
    hotel_room_requests?: string;
    hotel_confirmation_number?: string;
    hotel_address?: string;
    hotel_contact_name?: string;
    hotel_contact_phone?: string;
    hotel_contact_email?: string;
  }>;
  
  // Activity booking fields
  activity_bookings?: Array<{
    activity_name?: string;
    activity_date?: string;
    activity_status?: string;
    activity_start_time?: string;
    activity_end_time?: string;
    activity_location?: string;
    activity_pickup_time?: string;
    activity_pickup_location?: string;
    activity_collection_time?: string;
    activity_collection_location?: string;
    activity_dropoff_location?: string;
    activity_depart_for_activity?: string;
    activity_transport_mode?: string;
    activity_driver_name?: string;
    activity_driver_phone?: string;
    activity_transport_company?: string;
    activity_transport_contact_name?: string;
    activity_transport_phone?: string;
    activity_transport_email?: string;
    activity_contact_name?: string;
    activity_contact_phone?: string;
    activity_contact_email?: string;
    activity_hospitality_inclusions?: string;
    activity_notes?: string;
    activity_spots_available?: number;
    activity_spots_booked?: number;
    passengers_attending?: number;
  }>;

  // Computed condition fields (boolean flags for conditional template sections)
  has_passenger_2?: boolean;
  has_passenger_3?: boolean;
  has_multiple_passengers?: boolean;
  passenger_2_has_email?: boolean;
  passenger_2_missing_email?: boolean;
  passenger_3_has_email?: boolean;
  passenger_3_missing_email?: boolean;
  passenger_2_has_phone?: boolean;
  passenger_2_missing_phone?: boolean;
  passenger_3_has_phone?: boolean;
  passenger_3_missing_phone?: boolean;
  has_hotel_bookings?: boolean;
  has_activity_bookings?: boolean;
  has_accommodation?: boolean;
  no_accommodation?: boolean;
  has_group_name?: boolean;
  has_extra_requests?: boolean;
  tour_requires_travel_docs?: boolean;
  tour_requires_pickup?: boolean;
  has_pickup_selection?: boolean;
  missing_pickup_selection?: boolean;
  needs_passport_submission?: boolean;

  // Pickup location fields
  pickup_location_name?: string;
  pickup_location_time?: string;
  pickup_location_details?: string;

  // Actions (handled securely server-side in edge functions)
  // Client-side previews/sends should preserve placeholders so the server can generate tokens.
  profile_update_button?: string;
  profile_update_link?: string;
  pickup_button?: string;
  pickup_link?: string;
  itinerary_button?: string;
  itinerary_link?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subject_template: string;
  content_template: string;
  from_email: string;
  is_active: boolean;
  is_default: boolean;
}

export class EmailTemplateEngine {
  // Process template with merge data using Mustache-like syntax
  static processTemplate(template: string, data: EmailMergeData): string {
    let processed = template;
    
    // CRITICAL: Process loops FIRST before simple variable replacements
    // This ensures variables inside loops aren't replaced prematurely
    
    // Handle conditional sections {{#variable}}...{{/variable}}
    processed = processed.replace(/\{\{#([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, key, content) => {
      const value = this.getNestedValue(data, key.trim());
      
      // For arrays (like hotel_bookings), repeat the content for each item
      if (Array.isArray(value)) {
        console.log(`Processing array loop for ${key}:`, value.length, 'items');
        return value.map((item, index) => {
          console.log(`Processing item ${index}:`, Object.keys(item));
          let itemContent = content;
          // Replace all variables within this iteration
          itemContent = itemContent.replace(/\{\{([^}#^/]+)\}\}/g, (innerMatch, innerKey) => {
            const trimmedKey = innerKey.trim();
            const itemValue = this.getNestedValue(item, trimmedKey);
            console.log(`  Replacing {{${trimmedKey}}} with:`, itemValue);

            // Keep empty values blank in loops
            if (itemValue === undefined || itemValue === null || itemValue === '') return '';
            return String(itemValue);
          });
          return itemContent;
        }).join('');
      }
      
      // For boolean/truthy values, include the content if truthy
      return value ? content : '';
    });
    
    // Handle inverted conditional sections {{^variable}}...{{/variable}}
    processed = processed.replace(/\{\{\^([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, key, content) => {
      const value = this.getNestedValue(data, key.trim());
      return !value ? content : '';
    });
    
    // Handle simple variable replacements {{variable}} AFTER loops
    processed = processed.replace(/\{\{([^}#^/]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(data, trimmedKey);

      // Empty field handling: show N/A for specific field types when empty
      if (value === undefined || value === null || value === '') {
        // Fields that should show N/A when empty
        const naFields = [
          /passenger_(2|3)/,                    // All passenger 2/3 fields
          /dietary/i,                           // Dietary requirements
          /accessibility/i,                     // Accessibility needs
          /medical/i,                           // Medical conditions
          /emergency_contact/i,                 // Emergency contact fields
          /booking_passenger_2_name/,           // Legacy passenger name fields
          /booking_passenger_3_name/,
        ];
        
        const shouldShowNA = naFields.some(pattern => pattern.test(trimmedKey));
        return shouldShowNA ? 'N/A' : '';
      }
      
      return String(value);
    });
    
    return processed;
  }
  
  // Get nested object value using dot notation
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  // Format date for display
  static formatDate(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  // Convert booking data to merge data format
  static convertBookingToMergeData(booking: any): EmailMergeData {
    const customer = booking.customers || {};
    const tour = booking.tours || {};
    const hotelBookings = booking.hotel_bookings || [];
    const activityBookings = booking.activity_bookings || [];
    
    return {
      // Customer fields (dynamic - will be overridden for additional passengers)
      customer_first_name: customer.first_name,
      customer_last_name: customer.last_name,
      customer_preferred_name: customer.preferred_name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_city: customer.city,
      customer_state: customer.state,
      customer_country: customer.country,
      customer_spouse_name: customer.spouse_name,
      customer_dietary_requirements: customer.dietary_requirements,
      customer_medical_conditions: customer.medical_conditions,
      customer_accessibility_needs: customer.accessibility_needs,
      customer_emergency_contact_name: customer.emergency_contact_name,
      customer_emergency_contact_phone: customer.emergency_contact_phone,
      customer_emergency_contact_relationship: customer.emergency_contact_relationship,
      customer_emergency_contact_email: customer.emergency_contact_email,
      customer_notes: customer.notes,

      // Lead passenger fields (static - always the lead passenger regardless of recipient)
      lead_passenger_first_name: customer.first_name,
      lead_passenger_last_name: customer.last_name,
      lead_passenger_preferred_name: customer.preferred_name,
      lead_passenger_email: customer.email,
      lead_passenger_phone: customer.phone,
      lead_passenger_city: customer.city,
      lead_passenger_state: customer.state,
      lead_passenger_country: customer.country,
      lead_passenger_spouse_name: customer.spouse_name,
      lead_passenger_dietary_requirements: customer.dietary_requirements,
      lead_passenger_medical_conditions: customer.medical_conditions,
      lead_passenger_accessibility_needs: customer.accessibility_needs,
      lead_passenger_emergency_contact_name: customer.emergency_contact_name,
      lead_passenger_emergency_contact_phone: customer.emergency_contact_phone,
      lead_passenger_emergency_contact_relationship: customer.emergency_contact_relationship,
      lead_passenger_emergency_contact_email: customer.emergency_contact_email,

      // Nested objects for dot notation templates
      customer: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        preferred_name: customer.preferred_name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
        state: customer.state,
        country: customer.country,
        spouse_name: customer.spouse_name,
        dietary_requirements: customer.dietary_requirements,
        medical_conditions: customer.medical_conditions,
        accessibility_needs: customer.accessibility_needs,
        emergency_contact_name: customer.emergency_contact_name,
        emergency_contact_phone: customer.emergency_contact_phone,
        emergency_contact_relationship: customer.emergency_contact_relationship,
        emergency_contact_email: customer.emergency_contact_email,
        notes: customer.notes,
      },
      
      // Tour fields
      tour_name: tour.name,
      tour_location: tour.location,
      tour_type: tour.tour_type,
      tour_start_date: this.formatDate(tour.start_date),
      tour_end_date: this.formatDate(tour.end_date),
      tour_days: tour.days,
      tour_nights: tour.nights,
      tour_pickup_point: tour.pickup_point,
      tour_notes: tour.notes,
      tour_inclusions: tour.inclusions,
      tour_exclusions: tour.exclusions,
      tour_host: tour.tour_host,
      tour_capacity: tour.capacity,
      tour_minimum_passengers: tour.minimum_passengers_required,
      tour_price_single: tour.price_single,
      tour_price_double: tour.price_double,
      tour_price_twin: tour.price_twin,
      tour_deposit_required: tour.deposit_required,
      tour_final_payment_date: this.formatDate(tour.final_payment_date),
      tour_instalment_date: this.formatDate(tour.instalment_date),
      tour_instalment_amount: tour.instalment_amount,
      tour_instalment_details: tour.instalment_details,
      tour_travel_documents_required: tour.travel_documents_required,

      tour: {
        name: tour.name,
        location: tour.location,
        tour_type: tour.tour_type,
        start_date: tour.start_date,
        end_date: tour.end_date,
        days: tour.days,
        nights: tour.nights,
        pickup_point: tour.pickup_point,
        notes: tour.notes,
        inclusions: tour.inclusions,
        exclusions: tour.exclusions,
        tour_host: tour.tour_host,
        capacity: tour.capacity,
        minimum_passengers_required: tour.minimum_passengers_required,
        price_single: tour.price_single,
        price_double: tour.price_double,
        price_twin: tour.price_twin,
        deposit_required: tour.deposit_required,
        final_payment_date: tour.final_payment_date,
        instalment_date: tour.instalment_date,
        instalment_amount: tour.instalment_amount,
        instalment_details: tour.instalment_details,
        travel_documents_required: tour.travel_documents_required,
      },
      
      // Booking fields
      booking_passenger_count: booking.passenger_count,
      booking_status: booking.status,
      booking_check_in_date: this.formatDate(booking.check_in_date),
      booking_check_out_date: this.formatDate(booking.check_out_date),
      booking_total_nights: booking.total_nights,
      booking_passenger_2_name: booking.passenger_2_name,
      booking_passenger_3_name: booking.passenger_3_name,
      booking_group_name: booking.group_name,
      booking_booking_agent: booking.booking_agent,
      booking_notes_requests: booking.booking_notes,
      booking_invoice_notes: booking.invoice_notes,
      booking_passport_number: booking.passport_number,
      booking_passport_country: booking.passport_country,
      booking_passport_expiry_date: this.formatDate(booking.passport_expiry_date),
      booking_nationality: booking.nationality,
      booking_revenue: booking.revenue,
      booking_accommodation_required: booking.accommodation_required,
      booking_whatsapp_group_comms: booking.whatsapp_group_comms,

      // Passenger 2 fields (from linked contact record)
      passenger_2_first_name: booking.passenger_2?.first_name,
      passenger_2_last_name: booking.passenger_2?.last_name,
      passenger_2_preferred_name: booking.passenger_2?.preferred_name,
      passenger_2_email: booking.passenger_2?.email,
      passenger_2_phone: booking.passenger_2?.phone,
      passenger_2_dietary_requirements: booking.passenger_2?.dietary_requirements,
      passenger_2_medical_conditions: booking.passenger_2?.medical_conditions,
      passenger_2_accessibility_needs: booking.passenger_2?.accessibility_needs,
      passenger_2_emergency_contact_name: booking.passenger_2?.emergency_contact_name,
      passenger_2_emergency_contact_phone: booking.passenger_2?.emergency_contact_phone,
      passenger_2_emergency_contact_relationship: booking.passenger_2?.emergency_contact_relationship,
      passenger_2_emergency_contact_email: booking.passenger_2?.emergency_contact_email,

      // Passenger 3 fields (from linked contact record)
      passenger_3_first_name: booking.passenger_3?.first_name,
      passenger_3_last_name: booking.passenger_3?.last_name,
      passenger_3_preferred_name: booking.passenger_3?.preferred_name,
      passenger_3_email: booking.passenger_3?.email,
      passenger_3_phone: booking.passenger_3?.phone,
      passenger_3_dietary_requirements: booking.passenger_3?.dietary_requirements,
      passenger_3_medical_conditions: booking.passenger_3?.medical_conditions,
      passenger_3_accessibility_needs: booking.passenger_3?.accessibility_needs,
      passenger_3_emergency_contact_name: booking.passenger_3?.emergency_contact_name,
      passenger_3_emergency_contact_phone: booking.passenger_3?.emergency_contact_phone,
      passenger_3_emergency_contact_relationship: booking.passenger_3?.emergency_contact_relationship,
      passenger_3_emergency_contact_email: booking.passenger_3?.emergency_contact_email,

      booking: {
        passenger_count: booking.passenger_count,
        status: booking.status,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        total_nights: booking.total_nights,
        passenger_2_name: booking.passenger_2_name,
        passenger_3_name: booking.passenger_3_name,
        group_name: booking.group_name,
        booking_agent: booking.booking_agent,
        extra_requests: booking.booking_notes,
        invoice_notes: booking.invoice_notes,
        passport_number: booking.passport_number,
        passport_country: booking.passport_country,
        passport_expiry_date: booking.passport_expiry_date,
        nationality: booking.nationality,
        revenue: booking.revenue,
        accommodation_required: booking.accommodation_required,
        whatsapp_group_comms: booking.whatsapp_group_comms,
      },
      
      // Hotel bookings
      hotel_bookings: hotelBookings.map((hb: any) => ({
        hotel_name: hb.hotels?.name,
        hotel_check_in_date: this.formatDate(hb.check_in_date),
        hotel_check_out_date: this.formatDate(hb.check_out_date),
        hotel_nights: hb.nights,
        hotel_room_type: hb.room_type,
        hotel_bedding: hb.bedding,
        hotel_room_upgrade: hb.room_upgrade,
        hotel_room_requests: hb.room_requests,
        hotel_confirmation_number: hb.confirmation_number,
        hotel_address: hb.hotels?.address,
        hotel_contact_name: hb.hotels?.contact_name,
        hotel_contact_phone: hb.hotels?.contact_phone,
        hotel_contact_email: hb.hotels?.contact_email,
        hotel_extra_night_price: hb.hotels?.extra_night_price,
      })),
      
      // Activity bookings
      activity_bookings: activityBookings.map((ab: any) => ({
        activity_name: ab.activities?.name,
        activity_date: this.formatDate(ab.activities?.activity_date),
        activity_status: ab.activities?.activity_status,
        activity_start_time: ab.activities?.start_time,
        activity_end_time: ab.activities?.end_time,
        activity_location: ab.activities?.location,
        activity_pickup_time: (ab.activities?.activity_journeys || []).sort((a: any, b: any) => a.journey_number - b.journey_number)[0]?.pickup_time || '',
        activity_pickup_location: (ab.activities?.activity_journeys || []).sort((a: any, b: any) => a.journey_number - b.journey_number)[0]?.pickup_location || '',
        activity_collection_time: (ab.activities?.activity_journeys || []).sort((a: any, b: any) => a.journey_number - b.journey_number)[1]?.pickup_time || '',
        activity_collection_location: (ab.activities?.activity_journeys || []).sort((a: any, b: any) => a.journey_number - b.journey_number)[1]?.pickup_location || '',
        activity_dropoff_location: (ab.activities?.activity_journeys || []).sort((a: any, b: any) => a.journey_number - b.journey_number)[0]?.destination || '',
        activity_depart_for_activity: ab.activities?.depart_for_activity,
        activity_transport_mode: ab.activities?.transport_mode,
        activity_driver_name: ab.activities?.driver_name,
        activity_driver_phone: ab.activities?.driver_phone,
        activity_transport_company: ab.activities?.transport_company,
        activity_transport_contact_name: ab.activities?.transport_contact_name,
        activity_transport_phone: ab.activities?.transport_phone,
        activity_transport_email: ab.activities?.transport_email,
        activity_contact_name: ab.activities?.contact_name,
        activity_contact_phone: ab.activities?.contact_phone,
        activity_contact_email: ab.activities?.contact_email,
        activity_hospitality_inclusions: ab.activities?.hospitality_inclusions,
        activity_notes: ab.activities?.notes,
        activity_spots_available: ab.activities?.spots_available,
        activity_spots_booked: ab.activities?.spots_booked,
        passengers_attending: ab.passengers_attending,
      })),

      // Computed condition fields
      has_passenger_2: !!booking.passenger_2,
      has_passenger_3: !!booking.passenger_3,
      has_multiple_passengers: (booking.passenger_count || 1) > 1,
      passenger_2_has_email: !!booking.passenger_2?.email,
      passenger_2_missing_email: !!booking.passenger_2 && !booking.passenger_2?.email,
      passenger_3_has_email: !!booking.passenger_3?.email,
      passenger_3_missing_email: !!booking.passenger_3 && !booking.passenger_3?.email,
      passenger_2_has_phone: !!booking.passenger_2?.phone,
      passenger_2_missing_phone: !!booking.passenger_2 && !booking.passenger_2?.phone,
      passenger_3_has_phone: !!booking.passenger_3?.phone,
      passenger_3_missing_phone: !!booking.passenger_3 && !booking.passenger_3?.phone,
      has_hotel_bookings: hotelBookings.length > 0,
      has_activity_bookings: activityBookings.length > 0,
      has_accommodation: !!booking.accommodation_required,
      no_accommodation: !booking.accommodation_required,
      has_group_name: !!booking.group_name,
      has_extra_requests: !!booking.booking_notes,
      tour_requires_travel_docs: !!tour.travel_documents_required,
      tour_requires_pickup: !!tour.pickup_location_required,
      has_pickup_selection: !!booking.selected_pickup_option,
      missing_pickup_selection: !!tour.pickup_location_required && !booking.selected_pickup_option,
      needs_passport_submission: !!tour.travel_documents_required,  // Client-side doesn't have passport data; server overrides per-recipient

      // Pickup location fields
      pickup_location_name: booking.selected_pickup_option?.name || '',
      pickup_location_time: booking.selected_pickup_option?.pickup_time || '',
      pickup_location_details: booking.selected_pickup_option?.details || '',

      // Actions
      // IMPORTANT: Tokens/links must be generated server-side.
      // When bulk-email flows pre-process templates on the client, we MUST NOT erase these.
      profile_update_button: '{{profile_update_button}}',
      profile_update_link: '{{profile_update_link}}',
      pickup_button: '{{pickup_button}}',
      pickup_link: '{{pickup_link}}',
    };
  }
}