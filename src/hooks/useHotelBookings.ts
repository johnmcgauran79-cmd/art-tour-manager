
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

// Helper function to update booking dates based on hotel bookings
const updateBookingDates = async (bookingId: string) => {
  const { data: hotelBookings, error } = await supabase
    .from('hotel_bookings')
    .select('check_in_date, check_out_date, allocated')
    .eq('booking_id', bookingId);

  if (error || !hotelBookings) {
    console.error('Error fetching hotel bookings for date update:', error);
    return;
  }

  const allocatedBookings = hotelBookings.filter(hb => hb.allocated);
  
  if (allocatedBookings.length === 0) return;

  const checkInDates = allocatedBookings
    .map(hb => hb.check_in_date)
    .filter(date => date !== null)
    .map(date => new Date(date!));
  
  const checkOutDates = allocatedBookings
    .map(hb => hb.check_out_date)
    .filter(date => date !== null)
    .map(date => new Date(date!));

  if (checkInDates.length === 0 || checkOutDates.length === 0) return;

  const earliestCheckIn = new Date(Math.min(...checkInDates.map(d => d.getTime())));
  const latestCheckOut = new Date(Math.max(...checkOutDates.map(d => d.getTime())));

  await supabase
    .from('bookings')
    .update({
      check_in_date: earliestCheckIn.toISOString().split('T')[0],
      check_out_date: latestCheckOut.toISOString().split('T')[0],
    })
    .eq('id', bookingId);
};

export const useCreateHotelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (hotelBookingData: HotelBookingInsert) => {
      console.log('Creating hotel booking with data:', hotelBookingData);
      
      // Check for existing allocated booking with same booking_id and hotel_id
      if (hotelBookingData.booking_id && hotelBookingData.hotel_id && hotelBookingData.allocated) {
        const { data: existingBookings, error: checkError } = await supabase
          .from('hotel_bookings')
          .select('id, allocated')
          .eq('booking_id', hotelBookingData.booking_id)
          .eq('hotel_id', hotelBookingData.hotel_id)
          .eq('allocated', true);

        if (checkError) {
          console.error('Error checking for existing hotel booking:', checkError);
          throw new Error('Failed to verify booking uniqueness');
        }

        if (existingBookings && existingBookings.length > 0) {
          console.warn('Duplicate allocated hotel booking prevented:', existingBookings);
          throw new Error('Hotel is already allocated to this booking. Please remove the existing allocation first.');
        }
      }

      const { data, error } = await supabase
        .from('hotel_bookings')
        .insert(hotelBookingData)
        .select()
        .single();

      if (error) {
        console.error('Error creating hotel booking:', error);
        // Handle unique constraint violation with user-friendly message
        if (error.code === '23505' && error.message.includes('idx_hotel_bookings_unique_allocation')) {
          throw new Error('Hotel is already allocated to this booking. Please remove the existing allocation first.');
        }
        throw error;
      }
      console.log('Hotel booking created successfully:', data);
      
      return data;
    },
    onSuccess: async (data) => {
      // Update parent booking dates after creation
      if (data?.booking_id) {
        await updateBookingDates(data.booking_id);
      }
      
      // Batch invalidate queries to prevent cascade
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['hotels'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
      ]);
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
      
      // Clean the updates object - remove undefined values, convert empty strings to null for dates
      const cleanUpdates: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          // Convert empty strings to null for date fields
          if ((key === 'check_in_date' || key === 'check_out_date') && value === '') {
            cleanUpdates[key] = null;
          } else {
            cleanUpdates[key] = value;
          }
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
    onSuccess: async (data) => {
      // Update parent booking dates after update
      if (data?.booking_id) {
        await updateBookingDates(data.booking_id);
      }
      
      // Batch invalidate queries to prevent cascade
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['hotels'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
      ]);
      
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

// New hook for cleaning up duplicate hotel bookings
export const useCleanupDuplicateHotelBookings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, hotelId, keepId }: { bookingId: string; hotelId: string; keepId: string }) => {
      console.log('Cleaning up duplicate hotel bookings, keeping:', keepId);
      
      const { data: duplicates, error: findError } = await supabase
        .from('hotel_bookings')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('hotel_id', hotelId)
        .neq('id', keepId);

      if (findError) {
        console.error('Error finding duplicate hotel bookings:', findError);
        throw findError;
      }

      if (!duplicates || duplicates.length === 0) {
        console.log('No duplicates found to clean up');
        return 0;
      }

      const { error: deleteError } = await supabase
        .from('hotel_bookings')
        .delete()
        .in('id', duplicates.map(d => d.id));

      if (deleteError) {
        console.error('Error deleting duplicate hotel bookings:', deleteError);
        throw deleteError;
      }

      console.log(`Successfully removed ${duplicates.length} duplicate hotel booking record(s)`);
      return duplicates.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
    },
  });
};

// New hook for safely removing hotel allocation
export const useRemoveHotelAllocation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, hotelId }: { bookingId: string; hotelId: string }) => {
      console.log('Removing hotel allocation for booking:', bookingId, 'hotel:', hotelId);
      
      // First find all hotel bookings for this booking and hotel combination
      const { data: existingBookings, error: findError } = await supabase
        .from('hotel_bookings')
        .select('id, allocated')
        .eq('booking_id', bookingId)
        .eq('hotel_id', hotelId);

      if (findError) {
        console.error('Error finding hotel bookings to remove:', findError);
        throw findError;
      }

      if (!existingBookings || existingBookings.length === 0) {
        console.log('No hotel bookings found to remove');
        return;
      }

      // Delete all hotel bookings for this combination
      const { error: deleteError } = await supabase
        .from('hotel_bookings')
        .delete()
        .eq('booking_id', bookingId)
        .eq('hotel_id', hotelId);

      if (deleteError) {
        console.error('Error deleting hotel bookings:', deleteError);
        throw deleteError;
      }
      
      console.log(`Successfully removed ${existingBookings.length} hotel booking record(s)`);
      
      // Update parent booking dates after removal
      await updateBookingDates(bookingId);
      
      return existingBookings.length;
    },
    onSuccess: (removedCount) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (removedCount && removedCount > 1) {
        toast({
          title: "Hotel Allocation Removed",
          description: `Removed ${removedCount} duplicate hotel booking records.`,
        });
      } else {
        toast({
          title: "Hotel Allocation Removed",
          description: "Hotel allocation has been successfully removed.",
        });
      }
    },
    onError: (error: any) => {
      console.error('Hotel allocation removal failed:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to remove hotel allocation. Please try again.",
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
      
      // Get booking_id before deletion
      const { data: hotelBooking } = await supabase
        .from('hotel_bookings')
        .select('booking_id')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('hotel_bookings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting hotel booking:', error);
        throw error;
      }
      console.log('Hotel booking deleted successfully');
      
      // Update parent booking dates after deletion
      if (hotelBooking?.booking_id) {
        await updateBookingDates(hotelBooking.booking_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
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
