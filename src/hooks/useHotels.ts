
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
      
      // First fetch the hotels
      const { data: hotels, error: hotelsError } = await supabase
        .from('hotels')
        .select('*')
        .eq('tour_id', tourId)
        .order('default_check_in', { ascending: true, nullsFirst: false });
      
      if (hotelsError) {
        console.error('Error fetching hotels:', hotelsError);
        throw hotelsError;
      }

      // Then fetch total nights for each hotel from hotel_bookings (only for non-cancelled bookings)
      const hotelsWithNights = await Promise.all(
        (hotels || []).map(async (hotel) => {
          const { data: bookings, error: bookingsError } = await supabase
            .from('hotel_bookings')
            .select(`
              nights,
              bookings!inner(status)
            `)
            .eq('hotel_id', hotel.id)
            .neq('bookings.status', 'cancelled')
            .not('nights', 'is', null);

          if (bookingsError) {
            console.error('Error fetching hotel bookings for hotel:', hotel.id, bookingsError);
            return { ...hotel, total_nights: 0 };
          }

          const totalNights = bookings?.reduce((sum, booking) => sum + (booking.nights || 0), 0) || 0;
          console.log(`Hotel ${hotel.name}: Found ${bookings?.length} bookings with total nights: ${totalNights}`);
          return { ...hotel, total_nights: totalNights };
        })
      );
      
      console.log('Hotels with nights fetched successfully:', hotelsWithNights);
      return hotelsWithNights as Hotel[];
    },
    enabled: !!tourId && tourId.trim() !== '',
  });
};
