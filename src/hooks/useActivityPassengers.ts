import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityPassenger {
  booking_id: string;
  passengers_attending: number;
  lead_passenger_name: string;
  passenger_2_name?: string;
  passenger_3_name?: string;
  dietary_restrictions?: string;
}

export const useActivityPassengers = (activityId: string) => {
  return useQuery({
    queryKey: ['activity-passengers', activityId],
    queryFn: async () => {
      console.log('Fetching passengers for activity:', activityId);
      
      const { data, error } = await supabase
        .from('activity_bookings')
        .select(`
          booking_id,
          passengers_attending,
          bookings!inner(
            id,
            passenger_2_name,
            passenger_3_name,
            dietary_restrictions,
            customers!lead_passenger_id!inner(
              first_name,
              last_name
            )
          )
        `)
        .eq('activity_id', activityId)
        .gt('passengers_attending', 0) // Only passengers with positive ticket count
        .not('bookings.status', 'eq', 'cancelled');
      
      if (error) {
        console.error('Error fetching activity passengers:', error);
        throw error;
      }

      // Transform the data to include lead passenger name
      const passengers: ActivityPassenger[] = data?.map(item => ({
        booking_id: item.booking_id,
        passengers_attending: item.passengers_attending,
        lead_passenger_name: `${item.bookings.customers.first_name} ${item.bookings.customers.last_name}`,
        passenger_2_name: item.bookings.passenger_2_name || undefined,
        passenger_3_name: item.bookings.passenger_3_name || undefined, 
        dietary_restrictions: item.bookings.dietary_restrictions || undefined
      })) || [];

      console.log('Activity passengers fetched:', passengers);
      return passengers;
    },
    enabled: !!activityId,
  });
};