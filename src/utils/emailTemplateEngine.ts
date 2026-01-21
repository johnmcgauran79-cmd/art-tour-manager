// Email template engine with comprehensive mail merge fields
export interface EmailMergeData {
  // Customer fields
  customer_first_name?: string;
  customer_last_name?: string;
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
  customer_notes?: string;
  
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
  booking_extra_requests?: string;
  booking_invoice_notes?: string;
  booking_passport_number?: string;
  booking_passport_country?: string;
  booking_passport_expiry_date?: string;
  booking_nationality?: string;
  booking_id_number?: string;
  booking_revenue?: number;
  booking_accommodation_required?: boolean;
  booking_whatsapp_group_comms?: boolean;
  
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
            
            // Show N/A for empty values in loops (hotel/activity bookings)
            if (itemValue === undefined || itemValue === null || itemValue === '') {
              return 'N/A';
            }
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
      
      // If value is empty/null/undefined, show "N/A" for passenger and optional fields
      if (value === undefined || value === null || value === '') {
        // Show N/A for passenger names and other optional booking fields
        if (trimmedKey.includes('passenger_') || 
            trimmedKey.includes('booking_') ||
            trimmedKey.includes('emergency_') ||
            trimmedKey.includes('passport_') ||
            trimmedKey.includes('customer_spouse') ||
            trimmedKey.includes('customer_dietary') ||
            trimmedKey.includes('hotel_') ||
            trimmedKey.includes('activity_')) {
          return 'N/A';
        }
        return '';
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
      // Customer fields
      customer_first_name: customer.first_name,
      customer_last_name: customer.last_name,
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
      customer_notes: customer.notes,
      
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
      booking_extra_requests: booking.extra_requests,
      booking_invoice_notes: booking.invoice_notes,
      booking_passport_number: booking.passport_number,
      booking_passport_country: booking.passport_country,
      booking_passport_expiry_date: this.formatDate(booking.passport_expiry_date),
      booking_nationality: booking.nationality,
      booking_id_number: booking.id_number,
      booking_revenue: booking.revenue,
      booking_accommodation_required: booking.accommodation_required,
      booking_whatsapp_group_comms: booking.whatsapp_group_comms,
      
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
      })),
      
      // Activity bookings
      activity_bookings: activityBookings.map((ab: any) => ({
        activity_name: ab.activities?.name,
        activity_date: this.formatDate(ab.activities?.activity_date),
        activity_status: ab.activities?.activity_status,
        activity_start_time: ab.activities?.start_time,
        activity_end_time: ab.activities?.end_time,
        activity_location: ab.activities?.location,
        activity_pickup_time: ab.activities?.pickup_time,
        activity_pickup_location: ab.activities?.pickup_location,
        activity_collection_time: ab.activities?.collection_time,
        activity_collection_location: ab.activities?.collection_location,
        activity_dropoff_location: ab.activities?.dropoff_location,
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
    };
  }
}