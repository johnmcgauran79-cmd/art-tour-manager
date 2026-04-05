import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Fetches bookings for a specific tour only — much lighter than useBookings()
 * which fetches ALL bookings across all tours.
 * Use this in any component that only needs bookings for a single tour.
 */
export const useTourBookings = (tourId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bookings', 'tour', tourId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!tourId) return [];

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, tour_id, lead_passenger_id, secondary_contact_id, passenger_count,
          passenger_2_name, passenger_3_name, passenger_2_id, passenger_3_id,
          group_name, booking_agent, status, booking_notes, invoice_notes, invoice_reference,
          accommodation_required, check_in_date, check_out_date, total_nights,
          revenue, created_at, updated_at, passport_number, passport_expiry_date,
          passport_country, nationality, whatsapp_group_comms, selected_pickup_option_id,
          passport_not_required, split_invoice, id_number,
          tours (name),
          customers!lead_passenger_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs, avatar_url, notes),
          secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
          passenger_2:customers!passenger_2_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes),
          passenger_3:customers!passenger_3_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes)
        `)
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!tourId,
  });
};

/**
 * Fetches a single booking by ID — avoids loading all bookings just to find one.
 */
export const useBookingById = (bookingId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['booking', bookingId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!bookingId) return null;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, tour_id, lead_passenger_id, secondary_contact_id, passenger_count,
          passenger_2_name, passenger_3_name, passenger_2_id, passenger_3_id,
          group_name, booking_agent, status, booking_notes, invoice_notes, invoice_reference,
          accommodation_required, check_in_date, check_out_date, total_nights,
          revenue, created_at, updated_at, passport_number, passport_expiry_date,
          passport_country, nationality, whatsapp_group_comms, selected_pickup_option_id,
          passport_not_required, split_invoice, id_number,
          tours (name),
          customers!lead_passenger_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs, avatar_url, notes),
          secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
          passenger_2:customers!passenger_2_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes),
          passenger_3:customers!passenger_3_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes)
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!bookingId,
  });
};
