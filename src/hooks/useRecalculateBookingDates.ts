import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Recalculates booking dates based on associated hotel bookings
 * This ensures hotel bookings are the source of truth for check-in/check-out dates
 */
const recalculateBookingDates = async (bookingId: string) => {
  const { data: hotelBookings, error } = await supabase
    .from('hotel_bookings')
    .select('check_in_date, check_out_date')
    .eq('booking_id', bookingId)
    .not('check_in_date', 'is', null)
    .not('check_out_date', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch hotel bookings: ${error.message}`);
  }

  let checkInDate: string;
  let checkOutDate: string;
  let totalNights: number;
  let source: 'hotels' | 'tour' = 'hotels';

  if (!hotelBookings || hotelBookings.length === 0) {
    // No hotel bookings - fallback to tour dates
    console.log('No hotel bookings found for booking:', bookingId, '- falling back to tour dates');
    
    // Get the booking's tour_id first
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('tour_id')
      .eq('id', bookingId)
      .single();
    
    if (bookingError || !booking?.tour_id) {
      console.log('No tour associated with booking:', bookingId);
      return { updated: false, reason: 'No tour associated' };
    }
    
    // Get tour dates
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('start_date, end_date, nights')
      .eq('id', booking.tour_id)
      .single();
    
    if (tourError || !tour) {
      console.log('Tour not found for booking:', bookingId);
      return { updated: false, reason: 'Tour not found' };
    }
    
    checkInDate = tour.start_date;
    checkOutDate = tour.end_date;
    totalNights = tour.nights;
    source = 'tour';
  } else {
    // Find earliest check-in and latest check-out from hotel bookings
    const checkInDates = hotelBookings.map(hb => new Date(hb.check_in_date!));
    const checkOutDates = hotelBookings.map(hb => new Date(hb.check_out_date!));
    
    const earliestCheckIn = new Date(Math.min(...checkInDates.map(d => d.getTime())));
    const latestCheckOut = new Date(Math.max(...checkOutDates.map(d => d.getTime())));
    
    checkInDate = earliestCheckIn.toISOString().split('T')[0];
    checkOutDate = latestCheckOut.toISOString().split('T')[0];
    totalNights = Math.ceil((latestCheckOut.getTime() - earliestCheckIn.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Update the booking
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      total_nights: totalNights
    })
    .eq('id', bookingId);

  if (updateError) {
    throw new Error(`Failed to update booking dates: ${updateError.message}`);
  }

  return {
    updated: true,
    checkInDate,
    checkOutDate,
    totalNights,
    source
  };
};

/**
 * Hook to recalculate dates for a single booking
 */
export const useRecalculateBookingDates = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: recalculateBookingDates,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      
      if (result.updated) {
        toast({
          title: "Dates Recalculated",
          description: `Updated to ${result.checkInDate} - ${result.checkOutDate} (${result.totalNights} nights)`,
        });
      } else {
        toast({
          title: "No Changes",
          description: result.reason || "No updates needed",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to recalculate booking dates",
        variant: "destructive",
      });
    },
  });
};