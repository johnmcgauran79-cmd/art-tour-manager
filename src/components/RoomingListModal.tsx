
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Printer } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Hotel {
  id: string;
  name: string;
  address: string | null;
}

interface RoomingListModalProps {
  hotel: Hotel | null;
  tourId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RoomingListModal = ({ hotel, tourId, open, onOpenChange }: RoomingListModalProps) => {
  const { data: allBookings = [] } = useBookings();
  
  // Filter bookings for this tour
  const tourBookings = allBookings.filter(booking => 
    booking.tour_id === tourId && 
    booking.status !== 'cancelled' &&
    booking.accommodation_required
  );

  // Fetch hotel bookings for this specific hotel and tour
  const { data: hotelBookingsData = [] } = useQuery({
    queryKey: ['hotel-bookings-for-rooming', hotel?.id, tourId],
    queryFn: async () => {
      if (!hotel?.id) return [];
      
      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(`
          *,
          bookings!inner (
            id,
            tour_id,
            passenger_count,
            passenger_2_name,
            passenger_3_name,
            group_name,
            status,
            customers (first_name, last_name)
          )
        `)
        .eq('hotel_id', hotel.id)
        .eq('allocated', true)
        .eq('bookings.tour_id', tourId)
        .neq('bookings.status', 'cancelled');
      
      if (error) {
        console.error('Error fetching hotel bookings for rooming list:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!hotel?.id && !!tourId && open,
  });

  const getRoomingData = () => {
    return hotelBookingsData.map(hotelBooking => {
      const booking = hotelBooking.bookings;
      return {
        leadPassenger: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim(),
        passenger2: booking.passenger_2_name,
        passenger3: booking.passenger_3_name,
        groupName: booking.group_name,
        checkIn: hotelBooking.check_in_date ? new Date(hotelBooking.check_in_date).toLocaleDateString() : '-',
        checkOut: hotelBooking.check_out_date ? new Date(hotelBooking.check_out_date).toLocaleDateString() : '-',
        nights: hotelBooking.nights || '-',
        bedding: hotelBooking.bedding || '-',
        roomType: hotelBooking.room_type || '-',
        roomUpgrade: hotelBooking.room_upgrade || '-',
        roomRequests: hotelBooking.room_requests || '-',
        confirmationNumber: hotelBooking.confirmation_number || '-',
      };
    });
  };

  const roomingData = getRoomingData();

  const handleExportToPDF = () => {
    window.print();
  };

  const handleExportToTable = () => {
    const csvContent = [
      ['Lead Passenger', 'Passenger 2', 'Passenger 3', 'Group', 'Check In', 'Check Out', 'Nights', 'Bedding', 'Room Type', 'Upgrade', 'Requests', 'Confirmation'],
      ...roomingData.map(row => [
        row.leadPassenger,
        row.passenger2 || '',
        row.passenger3 || '',
        row.groupName || '',
        row.checkIn,
        row.checkOut,
        row.nights.toString(),
        row.bedding,
        row.roomType,
        row.roomUpgrade,
        row.roomRequests,
        row.confirmationNumber
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${hotel?.name}-rooming-list.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!hotel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Rooming List - {hotel.name}</DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handleExportToTable} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleExportToPDF} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print/PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>Hotel:</strong> {hotel.name}</p>
            {hotel.address && <p><strong>Address:</strong> {hotel.address}</p>}
            <p><strong>Total Rooms:</strong> {roomingData.length}</p>
          </div>

          {roomingData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No room allocations found for this hotel.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Passenger</TableHead>
                    <TableHead>Other Passengers</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Bedding</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Upgrade</TableHead>
                    <TableHead>Confirmation</TableHead>
                    <TableHead>Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomingData.map((room, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{room.leadPassenger}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {room.passenger2 && <div>{room.passenger2}</div>}
                          {room.passenger3 && <div>{room.passenger3}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{room.groupName}</TableCell>
                      <TableCell>{room.checkIn}</TableCell>
                      <TableCell>{room.checkOut}</TableCell>
                      <TableCell>{room.nights}</TableCell>
                      <TableCell className="capitalize">{room.bedding}</TableCell>
                      <TableCell>{room.roomType}</TableCell>
                      <TableCell>{room.roomUpgrade}</TableCell>
                      <TableCell>{room.confirmationNumber}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={room.roomRequests}>
                          {room.roomRequests}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
