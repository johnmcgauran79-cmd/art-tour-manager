import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Printer, Calendar, Mail } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToAustralian } from "@/lib/utils";
import { HotelRoomTypeReport } from "./HotelRoomTypeReport";
import { useSendRoomingList } from "@/hooks/useRoomingListEmail";
import { useTours } from "@/hooks/useTours";
import { EmailRoomingListModal } from "./EmailRoomingListModal";

interface Hotel {
  id: string;
  name: string;
  address: string | null;
  contact_email: string | null;
}

interface RoomingListModalProps {
  hotel: Hotel | null;
  tourId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RoomingListModal = ({ hotel, tourId, open, onOpenChange }: RoomingListModalProps) => {
  const [roomTypeReportOpen, setRoomTypeReportOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const { data: allBookings = [] } = useBookings();
  const { data: tours = [] } = useTours();
  const sendRoomingList = useSendRoomingList();

  const currentTour = tours.find(t => t.id === tourId);
  
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
            created_at,
            customers!lead_passenger_id (first_name, last_name)
          )
        `)
        .eq('hotel_id', hotel.id)
        .eq('allocated', true)
        .eq('bookings.tour_id', tourId)
        .neq('bookings.status', 'cancelled')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching hotel bookings for rooming list:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!hotel?.id && !!tourId && open,
  });

  const getRoomingData = () => {
    return hotelBookingsData.map((hotelBooking, index) => {
      const booking = hotelBooking.bookings;
      return {
        roomNumber: index + 1,
        leadPassenger: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim(),
        passenger2: booking.passenger_2_name,
        passenger3: booking.passenger_3_name,
        groupName: booking.group_name,
        checkIn: formatDateToAustralian(hotelBooking.check_in_date),
        checkOut: formatDateToAustralian(hotelBooking.check_out_date),
        nights: hotelBooking.nights || '-',
        bedding: hotelBooking.bedding || '-',
        roomType: hotelBooking.room_type || '-',
        roomUpgrade: hotelBooking.room_upgrade || '-',
        roomRequests: hotelBooking.room_requests || '-',
      };
    });
  };

  const roomingData = getRoomingData();

  const handleExportToPDF = () => {
    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr>
            ${['Room #', 'Lead Passenger', 'Other Passengers', 'Group', 'Check In', 'Check Out', 'Nights', 'Bedding', 'Room Type', 'Upgrade', 'Requests'].map(header => 
              `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2; font-weight: bold;">${header}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${roomingData.map(room => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.roomNumber}</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${room.leadPassenger}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">
                ${room.passenger2 ? `<div>${room.passenger2}</div>` : ''}
                ${room.passenger3 ? `<div>${room.passenger3}</div>` : ''}
              </td>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.groupName || ''}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.checkIn}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.checkOut}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.nights}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-transform: capitalize;">${room.bedding}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.roomType}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.roomUpgrade}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${room.roomRequests}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Rooming List - ${hotel?.name}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .hotel-info { margin-bottom: 20px; }
              .hotel-info p { margin: 5px 0; }
              @media print { 
                body { margin: 0; }
                tr { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <h1>Rooming List - ${hotel?.name}</h1>
            <div class="hotel-info">
              <p><strong>Hotel:</strong> ${hotel?.name}</p>
              ${hotel?.address ? `<p><strong>Address:</strong> ${hotel?.address}</p>` : ''}
              <p><strong>Total Rooms:</strong> ${roomingData.length}</p>
            </div>
            ${tableHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportToTable = () => {
    const csvContent = [
      ['Room #', 'Lead Passenger', 'Passenger 2', 'Passenger 3', 'Group', 'Check In', 'Check Out', 'Nights', 'Bedding', 'Room Type', 'Upgrade', 'Requests'],
      ...roomingData.map(row => [
        row.roomNumber.toString(),
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
        row.roomRequests
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

  const handleSendEmail = (emailData: { from: string; to: string; cc: string; bcc: string; subject: string; message: string }) => {
    if (!hotel || !currentTour) return;

    sendRoomingList.mutate({
      hotelId: hotel.id,
      tourId: tourId,
      tourName: currentTour.name,
      hotelEmail: emailData.to,
      hotelName: hotel.name,
      fromEmail: emailData.from,
      ccEmail: emailData.cc,
      bccEmail: emailData.bcc,
      subject: emailData.subject,
      message: emailData.message,
    }, {
      onSuccess: () => {
        setEmailModalOpen(false);
      }
    });
  };

  if (!hotel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Rooming List - {hotel.name}</DialogTitle>
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={() => setRoomTypeReportOpen(true)} 
                variant="outline" 
                size="sm"
                className="bg-primary/10 border-primary/20 hover:bg-primary/20"
              >
                <Calendar className="h-4 w-4 mr-2" />
                View Room Type/Date Report
              </Button>
              <Button 
                onClick={() => setEmailModalOpen(true)} 
                variant="outline" 
                size="sm"
                className="bg-green-50 border-green-200 hover:bg-green-100"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Email to Hotel
              </Button>
              <Button onClick={handleExportToTable} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleExportToPDF} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print/PDF
              </Button>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DialogClose>
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
                    <TableHead>Room #</TableHead>
                    <TableHead>Lead Passenger</TableHead>
                    <TableHead>Other Passengers</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Bedding</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Upgrade</TableHead>
                    <TableHead>Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomingData.map((room, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{room.roomNumber}</TableCell>
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
      
      <HotelRoomTypeReport
        hotel={hotel}
        tourId={tourId}
        open={roomTypeReportOpen}
        onOpenChange={setRoomTypeReportOpen}
      />

      <EmailRoomingListModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        hotelName={hotel.name}
        tourName={currentTour?.name || ''}
        defaultToEmail={hotel.contact_email || undefined}
        onSend={handleSendEmail}
        isSending={sendRoomingList.isPending}
      />
    </Dialog>
  );
};
