
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Activity {
  id: string;
  tour_id: string;
  name: string;
  location: string | null;
  activity_date: string | null;
  start_time: string | null;
  end_time: string | null;
  pickup_time: string | null;
  collection_time: string | null;
  pickup_location: string | null;
  collection_location: string | null;
  dropoff_location: string | null;
  spots_available: number | null;
  spots_booked: number | null;
  activity_status: string;
  transport_status: string;
  guide_name: string | null;
  guide_phone: string | null;
  guide_email: string | null;
  transport_company: string | null;
  transport_contact_name: string | null;
  transport_phone: string | null;
  transport_email: string | null;
  hospitality_inclusions: string | null;
  notes: string | null;
  operations_notes: string | null;
  transport_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useActivities = (tourId: string) => {
  return useQuery({
    queryKey: ['activities', tourId],
    queryFn: async () => {
      console.log('Fetching activities for tour:', tourId);
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching activities:', error);
        throw error;
      }
      console.log('Activities fetched successfully:', data);
      return data as Activity[];
    },
  });
};
