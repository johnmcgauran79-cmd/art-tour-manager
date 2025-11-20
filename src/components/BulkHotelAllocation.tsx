import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";

interface BulkHotelAllocationProps {
  tourId: string;
  onComplete?: () => void;
}

export const BulkHotelAllocation = ({ tourId, onComplete }: BulkHotelAllocationProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingsToFix, setBookingsToFix] = useState<any[]>([]);
  const [hotel, setHotel] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [tourId]);

  const loadData = async () => {
    // Get hotel for this tour
    const { data: hotelData } = await supabase
      .from('hotels')
      .select('*')
      .eq('tour_id', tourId)
      .single();
    
    setHotel(hotelData);

    // Get bookings needing hotel allocation
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, customers!lead_passenger_id(first_name, last_name)')
      .eq('tour_id', tourId)
      .eq('accommodation_required', true);

    if (!bookings) return;

    // Filter bookings without hotel allocations
    const bookingsNeedingHotel = [];
    for (const booking of bookings) {
      const { data: existingHotel } = await supabase
        .from('hotel_bookings')
        .select('id')
        .eq('booking_id', booking.id)
        .single();
      
      if (!existingHotel) {
        bookingsNeedingHotel.push(booking);
      }
    }

    setBookingsToFix(bookingsNeedingHotel);
  };

  const handleBulkAllocate = async () => {
    if (!hotel || bookingsToFix.length === 0) return;

    setIsProcessing(true);
    
    try {
      const allocations = bookingsToFix.map(booking => ({
        booking_id: booking.id,
        hotel_id: hotel.id,
        check_in_date: hotel.default_check_in,
        check_out_date: hotel.default_check_out,
        nights: calculateNights(hotel.default_check_in, hotel.default_check_out),
        allocated: true,
        bedding: (booking.passenger_count === 1 ? 'single' : 'double') as 'single' | 'double' | 'twin'
      }));

      const { error } = await supabase
        .from('hotel_bookings')
        .insert(allocations);

      if (error) throw error;

      // Update booking dates for each booking
      for (const booking of bookingsToFix) {
        await updateBookingDates(booking.id);
      }

      toast({
        title: "Success",
        description: `Hotel allocated to ${bookingsToFix.length} bookings`,
      });

      onComplete?.();
    } catch (error: any) {
      console.error('Error allocating hotels:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to allocate hotels",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

const updateBookingDates = async (bookingId: string) => {
  const { data: hotelBookings } = await supabase
    .from('hotel_bookings')
    .select('check_in_date, check_out_date')
    .eq('booking_id', bookingId);

  if (!hotelBookings || hotelBookings.length === 0) return;

  const checkInDates = hotelBookings
    .map(hb => hb.check_in_date)
    .filter(Boolean)
    .sort();
  
  const checkOutDates = hotelBookings
    .map(hb => hb.check_out_date)
    .filter(Boolean)
    .sort();

  if (checkInDates.length === 0 || checkOutDates.length === 0) return;

  const earliestCheckIn = checkInDates[0];
  const latestCheckOut = checkOutDates[checkOutDates.length - 1];
  const totalNights = calculateNights(earliestCheckIn, latestCheckOut);

  await supabase
    .from('bookings')
    .update({
      check_in_date: earliestCheckIn,
      check_out_date: latestCheckOut,
      total_nights: totalNights
    })
    .eq('id', bookingId);
};

  if (bookingsToFix.length === 0) {
    return <div className="text-sm text-muted-foreground">All bookings have hotel allocations.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <p className="font-medium">Bookings needing hotel allocation: {bookingsToFix.length}</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {bookingsToFix.map(booking => (
            <li key={booking.id}>
              • {booking.customers?.first_name} {booking.customers?.last_name} ({booking.passenger_count} pax)
            </li>
          ))}
        </ul>
      </div>
      
      {hotel && (
        <div className="text-sm text-muted-foreground">
          Will allocate: <span className="font-medium">{hotel.name}</span> ({hotel.default_check_in} to {hotel.default_check_out})
        </div>
      )}

      <Button 
        onClick={handleBulkAllocate} 
        disabled={isProcessing || !hotel}
      >
        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Allocate Hotel to All Bookings
      </Button>
    </div>
  );
};

const calculateNights = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return null;
  const nights = Math.floor(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );
  return nights;
};
