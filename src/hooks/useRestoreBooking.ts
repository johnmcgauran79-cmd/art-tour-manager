import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PreCancellationSnapshot {
  passenger_count?: number;
  check_in_date?: string | null;
  check_out_date?: string | null;
  total_nights?: number | null;
  revenue?: number | null;
  previous_status?: string;
  activity_passengers?: Record<string, number>;
  snapshot_at?: string;
  backfilled?: boolean;
}

export const useRestoreBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, restoreToStatus }: { bookingId: string; restoreToStatus?: string }) => {
      console.log('Restoring booking:', bookingId);

      // 1. Fetch current cancelled booking + snapshot
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('booking_notes, pre_cancellation_snapshot, status, cancelled_at')
        .eq('id', bookingId)
        .single();

      if (fetchError) throw fetchError;

      if (!booking.cancelled_at) {
        throw new Error('This booking is not cancelled.');
      }

      const snapshot = ((booking as any).pre_cancellation_snapshot || {}) as PreCancellationSnapshot;
      const targetStatus = restoreToStatus || snapshot.previous_status || 'pending';

      // Strip the trailing "CANCELLED: ..." block from notes (preserve original notes)
      const existingNotes = (booking as any).booking_notes || '';
      const restoredNotes = existingNotes
        .replace(/\n*CANCELLED:[^\n]*(\n[^\n]*)*$/m, '')
        .trim();

      // 2. Restore booking fields from snapshot
      const updates: Record<string, any> = {
        status: targetStatus,
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
        pre_cancellation_snapshot: null,
        booking_notes: restoredNotes || null,
      };

      if (snapshot.passenger_count !== undefined) updates.passenger_count = snapshot.passenger_count;
      if (snapshot.check_in_date !== undefined) updates.check_in_date = snapshot.check_in_date;
      if (snapshot.check_out_date !== undefined) updates.check_out_date = snapshot.check_out_date;
      if (snapshot.total_nights !== undefined) updates.total_nights = snapshot.total_nights;
      if (snapshot.revenue !== undefined) updates.revenue = snapshot.revenue;

      const { error: bookingError } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // 3. Restore hotel allocations (un-cancel them)
      const { error: hotelError } = await supabase
        .from('hotel_bookings')
        .update({
          cancelled_at: null,
          cancelled_by: null,
          cancellation_reason: null,
        } as any)
        .eq('booking_id', bookingId)
        .not('cancelled_at', 'is', null);

      if (hotelError) throw hotelError;

      // 4. Restore activity passenger counts from snapshot
      if (snapshot.activity_passengers) {
        for (const [activityBookingId, count] of Object.entries(snapshot.activity_passengers)) {
          await supabase
            .from('activity_bookings')
            .update({ passengers_attending: count })
            .eq('id', activityBookingId);
        }
      }

      return { bookingId, restoredStatus: targetStatus, backfilled: snapshot.backfilled };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activity-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });

      toast({
        title: "Booking Restored",
        description: result.backfilled
          ? "Hotel allocations restored. Please review passenger count, dates and revenue manually."
          : `Booking restored to "${result.restoredStatus}" with all allocations and notes intact.`,
      });
    },
    onError: (error: any) => {
      console.error('Restore failed:', error);
      toast({
        title: "Restore Failed",
        description: error?.message || "Could not restore booking. Please try again.",
        variant: "destructive",
      });
    },
  });
};
