
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
  booking_status: string;
  default_room_type: string | null;
  default_check_in: string | null;
  default_check_out: string | null;
  extra_night_price: number | null;
  operations_notes: string | null;
  upgrade_options: string | null;
  created_at: string;
  updated_at: string;
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
      
      const { data, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching hotels:', error);
        throw error;
      }
      console.log('Hotels fetched successfully:', data);
      return data as Hotel[];
    },
    enabled: !!tourId && tourId.trim() !== '',
  });
};
