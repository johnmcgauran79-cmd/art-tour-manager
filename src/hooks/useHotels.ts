
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Hotel {
  id: string;
  tour_id: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  rooms_reserved: number | null;
  rooms_booked: number | null;
  rooms_available: number | null;
  booking_status: string;
  default_room_type: string | null;
  default_check_in: string | null;
  default_check_out: string | null;
  extra_night_price: number | null;
  operations_notes: string | null;
  upgrade_options: string | null;
  created_at: string;
  updated_at: string;
  total_nights?: number;
}

export const useHotels = (tourId: string) => {
  return useQuery({
    queryKey: ['hotels', tourId],
    queryFn: async () => {
      console.log('Fetching hotels for tour:', tourId);
      
      if (!tourId || tourId.trim() === '') {
        console.log('No tour ID provided, returning empty array');
        return [];
      }
      
      // Fetch hotels with aggregated nights in a single query (avoids N+1)
      const { data: hotels, error: hotelsError } = await supabase
        .from('hotels')
        .select('*')
        .eq('tour_id', tourId)
        .order('default_check_in', { ascending: true, nullsFirst: false });
      
      if (hotelsError) {
        console.error('Error fetching hotels:', hotelsError);
        throw hotelsError;
      }

      if (!hotels || hotels.length === 0) return [] as Hotel[];

      // Fetch all hotel_bookings for this tour's hotels in ONE query instead of N queries
      const hotelIds = hotels.map(h => h.id);
      const { data: allHotelBookings, error: bookingsError } = await supabase
        .from('hotel_bookings')
        .select(`
          hotel_id,
          nights,
          bookings!inner(status)
        `)
        .in('hotel_id', hotelIds)
        .neq('bookings.status', 'cancelled')
        .not('nights', 'is', null);

      if (bookingsError) {
        console.error('Error fetching hotel bookings:', bookingsError);
        // Fall back to zero nights if query fails
        return hotels.map(h => ({ ...h, total_nights: 0 })) as Hotel[];
      }

      // Aggregate nights per hotel
      const nightsByHotel = new Map<string, number>();
      (allHotelBookings || []).forEach(hb => {
        const current = nightsByHotel.get(hb.hotel_id) || 0;
        nightsByHotel.set(hb.hotel_id, current + (hb.nights || 0));
      });

      const hotelsWithNights = hotels.map(hotel => ({
        ...hotel,
        total_nights: nightsByHotel.get(hotel.id) || 0,
      }));
      
      console.log('Hotels with nights fetched successfully:', hotelsWithNights.length);
      return hotelsWithNights as Hotel[];
    },
    enabled: !!tourId && tourId.trim() !== '',
  });
};
