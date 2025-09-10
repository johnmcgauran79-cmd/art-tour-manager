import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Hotel {
  id: string;
  name: string;
  address: string | null;
}

interface HotelRoomTypeReportProps {
  hotel: Hotel | null;
  tourId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RoomTypeData {
  [roomType: string]: {
    [date: string]: number;
  };
}

export const HotelRoomTypeReport = ({ hotel, tourId, open, onOpenChange }: HotelRoomTypeReportProps) => {
  // Fetch hotel bookings for this specific hotel and tour
  const { data: hotelBookingsData = [] } = useQuery({
    queryKey: ['hotel-bookings-room-type-report', hotel?.id, tourId],
    queryFn: async () => {
      if (!hotel?.id) return [];
      
      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(`
          *,
          bookings!inner (
            id,
            tour_id,
            status
          )
        `)
        .eq('hotel_id', hotel.id)
        .eq('allocated', true)
        .eq('bookings.tour_id', tourId)
        .neq('bookings.status', 'cancelled')
        .not('check_in_date', 'is', null)
        .not('check_out_date', 'is', null);
      
      if (error) {
        console.error('Error fetching hotel bookings for room type report:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!hotel?.id && !!tourId && open,
  });

  const generateRoomTypeData = (): { roomTypeData: RoomTypeData; allDates: string[]; roomTypes: string[] } => {
    if (!hotelBookingsData.length) return { roomTypeData: {}, allDates: [], roomTypes: [] };

    const roomTypeData: RoomTypeData = {};
    const dateSet = new Set<string>();

    // Process each booking to count room types per date
    hotelBookingsData.forEach(booking => {
      if (!booking.check_in_date || !booking.check_out_date) return;

      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      const roomType = booking.room_type || 'Unspecified';

      // Initialize room type if not exists
      if (!roomTypeData[roomType]) {
        roomTypeData[roomType] = {};
      }

      // Count this room type for each night
      const currentDate = new Date(checkIn);
      while (currentDate < checkOut) {
        const dateStr = format(currentDate, 'dd/MM/yyyy');
        dateSet.add(dateStr);
        
        if (!roomTypeData[roomType][dateStr]) {
          roomTypeData[roomType][dateStr] = 0;
        }
        roomTypeData[roomType][dateStr]++;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    const allDates = Array.from(dateSet).sort((a, b) => {
      const dateA = new Date(a.split('/').reverse().join('-'));
      const dateB = new Date(b.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    const roomTypes = Object.keys(roomTypeData).sort();

    return { roomTypeData, allDates, roomTypes };
  };

  const generateBeddingData = (): { beddingData: RoomTypeData; beddingTypes: string[] } => {
    if (!hotelBookingsData.length) return { beddingData: {}, beddingTypes: [] };

    const beddingData: RoomTypeData = {};
    const beddingSet = new Set<string>();

    // Process each booking to count bedding types per date
    hotelBookingsData.forEach(booking => {
      if (!booking.check_in_date || !booking.check_out_date) return;

      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      const beddingType = booking.bedding || 'Unspecified';
      beddingSet.add(beddingType);

      // Initialize bedding type if not exists
      if (!beddingData[beddingType]) {
        beddingData[beddingType] = {};
      }

      // Count this bedding type for each night
      const currentDate = new Date(checkIn);
      while (currentDate < checkOut) {
        const dateStr = format(currentDate, 'dd/MM/yyyy');
        
        if (!beddingData[beddingType][dateStr]) {
          beddingData[beddingType][dateStr] = 0;
        }
        beddingData[beddingType][dateStr]++;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    const beddingTypes = Array.from(beddingSet).sort();
    return { beddingData, beddingTypes };
  };

  const { roomTypeData, allDates, roomTypes } = generateRoomTypeData();
  const { beddingData, beddingTypes } = generateBeddingData();

  const handleExportToPDF = () => {
    const roomTypeTableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2; font-weight: bold;">Room Type</th>
            ${allDates.map(date => 
              `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #f2f2f2; font-weight: bold;">${date}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${roomTypes.map(roomType => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${roomType}</td>
              ${allDates.map(date => 
                `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${roomTypeData[roomType]?.[date] || 0}</td>`
              ).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const beddingTableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #e8f4f8; font-weight: bold;">Bedding Type</th>
            ${allDates.map(date => 
              `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #e8f4f8; font-weight: bold;">${date}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${beddingTypes.map(beddingType => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-transform: capitalize;">${beddingType}</td>
              ${allDates.map(date => 
                `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${beddingData[beddingType]?.[date] || 0}</td>`
              ).join('')}
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
            <title>Room Type Report - ${hotel?.name}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              h2 { color: #555; margin-top: 30px; margin-bottom: 15px; }
              .hotel-info { margin-bottom: 20px; }
              .hotel-info p { margin: 5px 0; }
              @media print { 
                body { margin: 0; }
                tr { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <h1>Room Type Report - ${hotel?.name}</h1>
            <div class="hotel-info">
              <p><strong>Hotel:</strong> ${hotel?.name}</p>
              ${hotel?.address ? `<p><strong>Address:</strong> ${hotel?.address}</p>` : ''}
              <p><strong>Total Room Types:</strong> ${roomTypes.length}</p>
            </div>
            <h2>By Room Type</h2>
            ${roomTypeTableHTML}
            <h2>By Bedding Type</h2>
            ${beddingTableHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportToCSV = () => {
    const roomTypeCsvContent = [
      ['Room Type', ...allDates],
      ...roomTypes.map(roomType => [
        roomType,
        ...allDates.map(date => (roomTypeData[roomType]?.[date] || 0).toString())
      ])
    ];

    const beddingCsvContent = [
      [],
      ['Bedding Type', ...allDates],
      ...beddingTypes.map(beddingType => [
        beddingType,
        ...allDates.map(date => (beddingData[beddingType]?.[date] || 0).toString())
      ])
    ];

    const csvContent = [...roomTypeCsvContent, ...beddingCsvContent]
      .map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${hotel?.name}-room-type-report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!hotel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Room Type/Date Report - {hotel.name}</DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handleExportToCSV} variant="outline" size="sm">
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
            <p><strong>Total Room Types:</strong> {roomTypes.length}</p>
            <p><strong>Total Bedding Types:</strong> {beddingTypes.length}</p>
          </div>

          {allDates.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No room allocations found for this hotel.
            </p>
          ) : (
            <div className="space-y-8">
              {/* Room Type Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">By Room Type</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-10 border-r">Room Type</TableHead>
                          {allDates.map(date => (
                            <TableHead key={date} className="text-center min-w-[100px]">
                              {date}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roomTypes.map((roomType) => (
                          <TableRow key={roomType}>
                            <TableCell className="sticky left-0 bg-background z-10 border-r font-medium">
                              {roomType}
                            </TableCell>
                            {allDates.map(date => (
                              <TableCell key={date} className="text-center">
                                {roomTypeData[roomType]?.[date] || 0}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Bedding Type Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">By Bedding Type</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="sticky left-0 bg-muted/30 z-10 border-r">Bedding Type</TableHead>
                          {allDates.map(date => (
                            <TableHead key={date} className="text-center min-w-[100px]">
                              {date}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {beddingTypes.map((beddingType) => (
                          <TableRow key={beddingType}>
                            <TableCell className="sticky left-0 bg-background z-10 border-r font-medium capitalize">
                              {beddingType}
                            </TableCell>
                            {allDates.map(date => (
                              <TableCell key={date} className="text-center">
                                {beddingData[beddingType]?.[date] || 0}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};