
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ActivityBooking {
  id: string;
  booking_id: string;
  activity_id: string;
  passengers_attending: number;
  created_at: string;
  updated_at: string;
}

export const useActivityBookings = (bookingId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['activity-bookings', bookingId],
    queryFn: async () => {
      console.log('Fetching activity bookings for booking:', bookingId);
      const { data, error } = await supabase
        .from('activity_bookings')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (error) {
        console.error('Error fetching activity bookings:', error);
        throw error;
      }
      console.log('Activity bookings fetched successfully:', data);
      return data as ActivityBooking[];
    },
    enabled: !!bookingId,
  });

  const createActivityBooking = useMutation({
    mutationFn: async (data: {
      booking_id: string;
      activity_id: string;
      passengers_attending: number;
    }) => {
      console.log('Creating activity booking:', data);
      
      const { data: result, error } = await supabase
        .from('activity_bookings')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-bookings', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (error) => {
      console.error('Error creating activity booking:', error);
    },
  });

  const updateActivityBooking = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ActivityBooking> & { id: string }) => {
      console.log('Updating activity booking:', { id, updates });
      const { data, error } = await supabase
        .from('activity_bookings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-bookings', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (error) => {
      console.error('Error updating activity booking:', error);
    },
  });

  const deleteActivityBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('activity_bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-bookings', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (error) => {
      console.error('Error deleting activity booking:', error);
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    createActivityBooking,
    updateActivityBooking,
    deleteActivityBooking,
  };
};
