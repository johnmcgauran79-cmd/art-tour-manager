
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface HotelBooking {
  id: string;
  booking_id: string;
  hotel_id: string;
  allocated: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  nights: number | null;
  bedding: 'single' | 'double' | 'twin' | 'triple' | 'family';
  room_type: string | null;
  room_upgrade: string | null;
  room_requests: string | null;
  confirmation_number: string | null;
  required: boolean;
  created_at: string;
  updated_at: string;
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
      return data;
    },
    enabled: !!bookingId,
  });
};

export const useCreateHotelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (hotelBookingData: Partial<HotelBooking>) => {
      const { data, error } = await supabase
        .from('hotel_bookings')
        .insert(hotelBookingData)
        .select()
        .single();

      if (error) throw error;
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
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create hotel booking allocation. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating hotel booking:', error);
    },
  });
};

export const useUpdateHotelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HotelBooking> & { id: string }) => {
      const { data, error } = await supabase
        .from('hotel_bookings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
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
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update hotel booking allocation. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating hotel booking:', error);
    },
  });
};

export const useDeleteHotelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hotel_bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast({
        title: "Hotel Booking Deleted",
        description: "Hotel booking allocation has been successfully removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete hotel booking allocation. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting hotel booking:', error);
    },
  });
};
