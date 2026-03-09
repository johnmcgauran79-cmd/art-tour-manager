
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityJourney {
  id: string;
  activity_id: string;
  journey_number: number;
  pickup_time: string | null;
  pickup_location: string | null;
  destination: string | null;
  sort_order: number;
}

export interface Activity {
  id: string;
  tour_id: string;
  name: string;
  location: string | null;
  activity_date: string | null;
  start_time: string | null;
  end_time: string | null;
  depart_for_activity: string | null;
  spots_available: number | null;
  spots_booked: number | null;
  activity_status: string;
  transport_status: string;
  transport_mode: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  transport_company: string | null;
  transport_contact_name: string | null;
  transport_phone: string | null;
  transport_email: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  dress_code: string | null;
  hospitality_inclusions: string | null;
  notes: string | null;
  operations_notes: string | null;
  transport_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined journeys
  activity_journeys?: ActivityJourney[];
}

export const useActivities = (tourId: string) => {
  return useQuery({
    queryKey: ['activities', tourId],
    queryFn: async () => {
      console.log('Fetching activities for tour:', tourId);
      
      if (!tourId) {
        console.log('No tour ID provided, returning empty array');
        return [];
      }
      
      const { data, error } = await supabase
        .from('activities')
        .select('*, activity_journeys(*)')
        .eq('tour_id', tourId)
        .order('activity_date', { ascending: true, nullsFirst: false })
        .order('start_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching activities:', error);
        throw error;
      }
      
      // Sort journeys within each activity
      const activities = (data || []).map((a: any) => ({
        ...a,
        activity_journeys: (a.activity_journeys || []).sort((x: any, y: any) => x.journey_number - y.journey_number),
      }));
      
      console.log('Activities fetched successfully for tour', tourId, ':', activities.length, 'activities');
      return activities as Activity[];
    },
    enabled: !!tourId,
  });
};
