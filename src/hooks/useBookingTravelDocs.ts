import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BookingTravelDoc {
  id: string;
  booking_id: string;
  passenger_slot: number;
  customer_id: string | null;
  name_as_per_passport: string | null;
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export const useBookingTravelDocs = (bookingId: string | undefined) => {
  return useQuery({
    queryKey: ['booking-travel-docs', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      
      const { data, error } = await supabase
        .from('booking_travel_docs')
        .select(`
          *,
          customer:customers(id, first_name, last_name)
        `)
        .eq('booking_id', bookingId)
        .order('passenger_slot', { ascending: true });

      if (error) throw error;
      return data as BookingTravelDoc[];
    },
    enabled: !!bookingId,
  });
};
