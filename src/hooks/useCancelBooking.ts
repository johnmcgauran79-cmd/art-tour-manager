
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, cancellationReason }: { bookingId: string; cancellationReason: string }) => {
      console.log('Cancelling booking:', bookingId, 'Reason:', cancellationReason);

      // Start a transaction to ensure all operations succeed or fail together
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('booking_notes')
        .eq('id', bookingId)
        .single();

      if (fetchError) {
        console.error('Error fetching booking:', fetchError);
        throw fetchError;
      }

      // Prepare the cancellation note for the booking_notes field
      const existingNotes = (booking as any).booking_notes || '';
      const cancellationNote = `CANCELLED: ${cancellationReason}`;
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${cancellationNote}`
        : cancellationNote;

      // 1. Update booking status and clear fields
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          passenger_count: 0,
          check_in_date: null,
          check_out_date: null,
          total_nights: null,
          booking_notes: updatedNotes,
          revenue: 0
        })
        .eq('id', bookingId);

      if (bookingError) {
        console.error('Error updating booking:', bookingError);
        throw bookingError;
      }

      // 2. Remove all hotel allocations for this booking
      const { error: hotelError } = await supabase
        .from('hotel_bookings')
        .delete()
        .eq('booking_id', bookingId);

      if (hotelError) {
        console.error('Error removing hotel allocations:', hotelError);
        throw hotelError;
      }

      // 3. Set all activity bookings to 0 passengers attending
      const { error: activityError } = await supabase
        .from('activity_bookings')
        .update({ passengers_attending: 0 })
        .eq('booking_id', bookingId);

      if (activityError) {
        console.error('Error updating activity bookings:', activityError);
        throw activityError;
      }

      console.log('Booking cancelled successfully');
      return { bookingId, cancellationReason };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activity-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: "Booking Cancelled",
        description: "The booking has been successfully cancelled and all allocations removed.",
      });
    },
    onError: (error) => {
      console.error('Error cancelling booking:', error);
      toast({
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    },
  });
};
