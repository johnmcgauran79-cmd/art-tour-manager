
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, cancellationReason }: { bookingId: string; cancellationReason: string }) => {
      console.log('Cancelling booking (soft):', bookingId, 'Reason:', cancellationReason);

      const { data: { user } } = await supabase.auth.getUser();

      // 1. Fetch current booking values to snapshot
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('booking_notes, passenger_count, check_in_date, check_out_date, total_nights, revenue, status')
        .eq('id', bookingId)
        .single();

      if (fetchError) {
        console.error('Error fetching booking:', fetchError);
        throw fetchError;
      }

      // 2. Fetch activity bookings to snapshot passenger counts
      const { data: activityBookings } = await supabase
        .from('activity_bookings')
        .select('id, passengers_attending')
        .eq('booking_id', bookingId);

      // Build snapshot
      const snapshot = {
        passenger_count: booking.passenger_count,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        total_nights: booking.total_nights,
        revenue: booking.revenue,
        previous_status: booking.status,
        activity_passengers: (activityBookings || []).reduce<Record<string, number>>((acc, ab) => {
          acc[ab.id] = ab.passengers_attending;
          return acc;
        }, {}),
        snapshot_at: new Date().toISOString(),
      };

      // Append cancellation note (preserves existing notes)
      const existingNotes = (booking as any).booking_notes || '';
      const cancellationNote = `CANCELLED: ${cancellationReason}`;
      const updatedNotes = existingNotes
        ? `${existingNotes}\n\n${cancellationNote}`
        : cancellationNote;

      // 3. Update booking: mark cancelled, store snapshot, clear active fields
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          passenger_count: 0,
          check_in_date: null,
          check_out_date: null,
          total_nights: null,
          revenue: 0,
          booking_notes: updatedNotes,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
          cancellation_reason: cancellationReason,
          pre_cancellation_snapshot: snapshot,
        } as any)
        .eq('id', bookingId);

      if (bookingError) {
        console.error('Error updating booking:', bookingError);
        throw bookingError;
      }

      // 4. SOFT-cancel hotel allocations (preserve all notes/dates/bedding for restore)
      const { error: hotelError } = await supabase
        .from('hotel_bookings')
        .update({
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
          cancellation_reason: cancellationReason,
        } as any)
        .eq('booking_id', bookingId)
        .is('cancelled_at', null);

      if (hotelError) {
        console.error('Error soft-cancelling hotel allocations:', hotelError);
        throw hotelError;
      }

      // 5. Zero out activity passenger counts (rows kept, original counts in snapshot)
      const { error: activityError } = await supabase
        .from('activity_bookings')
        .update({ passengers_attending: 0 })
        .eq('booking_id', bookingId);

      if (activityError) {
        console.error('Error updating activity bookings:', activityError);
        throw activityError;
      }

      console.log('Booking cancelled (soft) successfully');

      // 6. Remove Keap tags (fire-and-forget)
      try {
        // Check if this is a test tour — skip Keap removal entirely
        const { data: bookingTour } = await supabase
          .from('bookings')
          .select('tour_id, tours:tour_id(is_test_tour)')
          .eq('id', bookingId)
          .single();
        const isTestTour = !!(bookingTour?.tours as any)?.is_test_tour;

        if (isTestTour) {
          console.log('Test Tour: Skipping Keap tag removal for cancelled booking');
        } else {
          await supabase.functions.invoke('keap-remove-tag', {
            body: { bookingId },
          });
          console.log('Keap tag removal triggered for cancelled booking');
        }
      } catch (keapError) {
        console.error('Non-blocking: Failed to remove Keap tags:', keapError);
      }

      return { bookingId, cancellationReason };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activity-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Booking Cancelled",
        description: "The booking has been cancelled. Hotel allocations and notes have been preserved and can be restored if needed.",
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
