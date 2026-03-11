import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PassportReportData {
  passengerName: string;
  passengerType: string;
  bookingReference: string;
  bookingId: string;
  groupName: string;
  passportFirstName: string;
  passportMiddleName: string;
  passportSurname: string;
  passportNumber: string;
  passportCountry: string;
  passportExpiry: string;
  nationality: string;
  dateOfBirth: string;
  hasDocuments: boolean;
  passportNotRequired: boolean;
}

export const usePassportReport = (tourId: string) => {
  return useQuery({
    queryKey: ['passport-report', tourId],
    queryFn: async () => {
      // First get all active bookings for this tour
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          passenger_count,
          group_name,
          lead_passenger_id,
          passenger_2_id,
          passenger_2_name,
          passenger_3_id,
          passenger_3_name,
          passport_not_required,
          customers:lead_passenger_id (
            id,
            first_name,
            last_name
          )
        `)
        .eq('tour_id', tourId)
        .not('status', 'in', '("cancelled","waitlisted")');

      if (bookingsError) throw bookingsError;

      // Get travel docs for all bookings
      const bookingIds = bookings?.map(b => b.id) || [];
      
      const { data: travelDocs, error: docsError } = await supabase
        .from('booking_travel_docs')
        .select(`
          *,
          customer:customers (
            id,
            first_name,
            last_name
          )
        `)
        .in('booking_id', bookingIds)
        .order('passenger_slot', { ascending: true });

      if (docsError) throw docsError;

      // Build the report data
      const reportData: PassportReportData[] = [];

      for (const booking of bookings || []) {
        const customer = booking.customers as any;
        const bookingDocs = travelDocs?.filter(d => d.booking_id === booking.id) || [];
        const passportNotRequired = !!(booking as any).passport_not_required;
        
        // Helper to get passenger type label
        const getPassengerType = (slot: number): string => {
          switch (slot) {
            case 1: return 'Lead';
            case 2: return 'Pax 2';
            case 3: return 'Pax 3';
            default: return `Pax ${slot}`;
          }
        };

        // Process each passenger slot based on passenger_count
        for (let slot = 1; slot <= booking.passenger_count; slot++) {
          const doc = bookingDocs.find(d => d.passenger_slot === slot);
          
          // Get passenger name
          let passengerName = '';
          if (slot === 1) {
            passengerName = customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown';
          } else if (slot === 2) {
            passengerName = booking.passenger_2_name || 'Passenger 2';
          } else if (slot === 3) {
            passengerName = booking.passenger_3_name || 'Passenger 3';
          }

          const hasDocuments = !!(doc?.passport_number || doc?.passport_first_name || doc?.passport_surname);

          reportData.push({
            passengerName,
            passengerType: getPassengerType(slot),
            bookingReference: booking.id.substring(0, 8).toUpperCase(),
            bookingId: booking.id,
            groupName: booking.group_name || '',
            passportFirstName: doc?.passport_first_name || '',
            passportMiddleName: doc?.passport_middle_name || '',
            passportSurname: doc?.passport_surname || '',
            passportNumber: doc?.passport_number || '',
            passportCountry: doc?.passport_country || '',
            passportExpiry: doc?.passport_expiry_date || '',
            nationality: doc?.nationality || '',
            dateOfBirth: doc?.date_of_birth || '',
            hasDocuments,
            passportNotRequired,
          });
        }
      }

      // Sort by passenger name
      reportData.sort((a, b) => a.passengerName.localeCompare(b.passengerName));

      return reportData;
    },
    enabled: !!tourId,
  });
};
