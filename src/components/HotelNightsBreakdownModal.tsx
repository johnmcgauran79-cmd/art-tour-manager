import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

interface HotelNightsBreakdownModalProps {
  hotelId: string;
  hotelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BookingNightsData {
  nights: number;
  lead_passenger_name: string;
  booking_status: string;
}

export const HotelNightsBreakdownModal = ({
  hotelId,
  hotelName,
  open,
  onOpenChange,
}: HotelNightsBreakdownModalProps) => {
  const { data: bookingBreakdown, isLoading } = useQuery({
    queryKey: ['hotel-nights-breakdown', hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(`
          nights,
          bookings!inner(
            status,
            lead_passenger_id,
            customers!inner(
              first_name,
              last_name
            )
          )
        `)
        .eq('hotel_id', hotelId)
        .neq('bookings.status', 'cancelled')
        .not('nights', 'is', null);

      if (error) {
        console.error('Error fetching hotel nights breakdown:', error);
        throw error;
      }

      return data?.map(booking => ({
        nights: booking.nights || 0,
        lead_passenger_name: `${booking.bookings.customers.first_name} ${booking.bookings.customers.last_name}`,
        booking_status: booking.bookings.status
      })) || [];
    },
    enabled: open && !!hotelId,
  });

  const totalNights = bookingBreakdown?.reduce((sum, booking) => sum + booking.nights, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Room Nights Breakdown - {hotelName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4">Loading breakdown...</div>
          ) : (
            <>
              <div className="space-y-2">
                {bookingBreakdown?.map((booking, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-medium">{booking.lead_passenger_name}</span>
                      <Badge variant="outline" className="w-fit text-xs">
                        {booking.booking_status}
                      </Badge>
                    </div>
                    <span className="font-semibold text-lg">
                      {booking.nights} night{booking.nights !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-3">
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total Room Nights:</span>
                  <span>{totalNights}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};