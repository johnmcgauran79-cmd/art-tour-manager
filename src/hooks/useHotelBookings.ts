
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type HotelBookingRow = Database['public']['Tables']['hotel_bookings']['Row'];
type HotelBookingInsert = Database['public']['Tables']['hotel_bookings']['Insert'];
type HotelBookingUpdate = Database['public']['Tables']['hotel_bookings']['Update'];

export interface HotelBooking extends HotelBookingRow {
  hotels?: {
    name: string;
    default_check_in: string | null;
    default_check_out: string | null;
    default_room_type: string | null;
  };
}

export const useHotelBookings = (bookingId: string) => {
  return useQuery({
    queryKey: ['hotel-bookings', bookingId],
    queryFn: async () => {
      console.log('Fetching hotel bookings for booking:', bookingId);
      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(`
          *,
          hotels (name, default_check_in, default_check_out, default_room_type)
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching hotel bookings:', error);
        throw error;
      }
      console.log('Hotel bookings fetched successfully:', data);
      return data as HotelBooking[];
    },
    enabled: !!bookingId,
  });
};

export const useCreateHotelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (hotelBookingData: HotelBookingInsert) => {
      console.log('Creating hotel booking with data:', hotelBookingData);
      const { data, error } = await supabase
        .from('hotel_bookings')
        .insert(hotelBookingData)
        .select()
        .single();

      if (error) {
        console.error('Error creating hotel booking:', error);
        throw error;
      }
      console.log('Hotel booking created successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast({
        title: "Hotel Booking Created",
        description: "Hotel booking allocation has been successfully created.",
      });
    },
    onError: (error: any) => {
      console.error('Hotel booking creation failed:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create hotel booking allocation. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateHotelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: HotelBookingUpdate & { id: string }) => {
      console.log('Updating hotel booking:', id, 'with updates:', updates);
      
      // Clean the updates object - remove undefined values and ensure proper types
      const cleanUpdates: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      });

      console.log('Clean updates for hotel booking:', cleanUpdates);

      const { data, error } = await supabase
        .from('hotel_bookings')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating hotel booking:', error);
        throw new Error(`Failed to update hotel booking: ${error.message}`);
      }
      
      console.log('Hotel booking updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast({
        title: "Hotel Booking Updated",
        description: "Hotel booking allocation has been successfully updated.",
      });
    },
    onError: (error: any) => {
      console.error('Hotel booking update failed:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update hotel booking allocation. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteHotelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting hotel booking:', id);
      const { error } = await supabase
        .from('hotel_bookings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting hotel booking:', error);
        throw error;
      }
      console.log('Hotel booking deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast({
        title: "Hotel Booking Deleted",
        description: "Hotel booking allocation has been successfully removed.",
      });
    },
    onError: (error: any) => {
      console.error('Hotel booking deletion failed:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete hotel booking allocation. Please try again.",
        variant: "destructive",
      });
    },
  });
};
