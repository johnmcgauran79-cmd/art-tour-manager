import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Phone, Utensils, Hotel, Users, Eye } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useHotels } from "@/hooks/useHotels";
import { useHotelBookings } from "@/hooks/useHotelBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface TourOperationsReportsModalProps {
  tourId: string;
  tourName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType?: 'contacts' | 'dietary' | 'summary' | 'hotel' | null;
  hotelId?: string;
}

type ReportType = 'contacts' | 'dietary' | 'summary' | 'hotel';

interface ReportItem {
  id: string;
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  data: any[];
  hotelId?: string;
  hotelName?: string;
}

export const TourOperationsReportsModal = ({ 
  tourId, 
  tourName, 
  open, 
  onOpenChange,
  reportType = null,
  hotelId = undefined
}: TourOperationsReportsModalProps) => {
  const { data: allBookings } = useBookings();
  const { data: hotels } = useHotels(tourId);
  const { data: hotelBookings } = useHotelBookings('');
  
  const [selectedReports, setSelectedReports] = useState<string[]>([]);

  const tourBookings = (allBookings || []).filter(booking => 
    booking.tour_id === tourId && booking.status !== 'cancelled'
  );

  // Generate all available reports
  const generateReports = (): ReportItem[] => {
    const reports: ReportItem[] = [];

    // Contact List Report
    const contactList = tourBookings.map(booking => ({
      name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      phone: booking.customers?.phone || '',
      email: booking.customers?.email || '',
      passengerCount: booking.passenger_count
    }));

    reports.push({
      id: 'contacts',
      type: 'contacts',
      title: 'Contact List for WhatsApp',
      description: 'Complete contact information for all passengers',
      icon: <Phone className="h-5 w-5 text-blue-600" />,
      count: contactList.length,
      data: contactList
    });

    // Dietary Requirements Report
    const dietaryRequirements = tourBookings
      .map(booking => ({
        name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
        dietary: booking.customers?.dietary_requirements || '',
        passengerCount: booking.passenger_count,
        additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean)
      }))
      .filter(item => item.dietary && item.dietary.trim() !== '');

    reports.push({
      id: 'dietary',
      type: 'dietary',
      title: 'Dietary Requirements',
      description: 'Special dietary needs for all passengers',
      icon: <Utensils className="h-5 w-5 text-green-600" />,
      count: dietaryRequirements.length,
      data: dietaryRequirements
    });

    // Passenger Summary Report
    const passengerSummary = tourBookings.map(booking => ({
      leadPassenger: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean),
      passengerCount: booking.passenger_count,
      checkIn: formatDateToDDMMYYYY(booking.check_in_date),
      checkOut: formatDateToDDMMYYYY(booking.check_out_date),
      nights: booking.total_nights || 0,
      status: booking.status,
      notes: booking.extra_requests || '',
      groupName: booking.group_name || ''
    }));

    reports.push({
      id: 'summary',
      type: 'summary',
      title: 'Passenger Summary',
      description: 'Complete booking details for all passengers',
      icon: <Users className="h-5 w-5 text-purple-600" />,
      count: passengerSummary.length,
      data: passengerSummary
    });

    // Hotel Rooming Lists
    if (hotels && hotels.length > 0) {
      hotels.forEach((hotel) => {
        const hotelGuests = tourBookings.filter(booking => {
          return hotelBookings?.some(hb => hb.booking_id === booking.id && hb.hotel_id === hotel.id);
        });

        if (hotelGuests.length > 0) {
          const roomingData = hotelGuests.map((guest, index) => ({
            room: `Room ${index + 1}`,
            guestName: `${guest.customers?.first_name} ${guest.customers?.last_name}`,
            checkIn: formatDateToDDMMYYYY(guest.check_in_date),
            checkOut: formatDateToDDMMYYYY(guest.check_out_date),
            nights: guest.total_nights || 0,
            roomType: 'Standard',
            specialRequests: guest.extra_requests || ''
          }));

          reports.push({
            id: `hotel-${hotel.id}`,
            type: 'hotel',
            title: `${hotel.name} - Rooming List`,
            description: `Room assignments for ${hotel.name}`,
            icon: <Hotel className="h-5 w-5 text-orange-600" />,
            count: hotelGuests.length,
            data: roomingData,
            hotelId: hotel.id,
            hotelName: hotel.name
          });
        }
      });
    }

    return reports;
  };

  const reports = generateReports();

  // Get the specific report to display
  const getDisplayReport = (): ReportItem | null => {
    if (!reportType) return null;
    
    if (reportType === 'hotel' && hotelId) {
      return reports.find(r => r.type === 'hotel' && r.hotelId === hotelId) || null;
    }
    
    return reports.find(r => r.type === reportType) || null;
  };

  const displayReport = getDisplayReport();

  const exportReportToCSV = (report: ReportItem) => {
    let headers: string[] = [];
    let csvData: any[] = [];

    switch (report.type) {
      case 'contacts':
        headers = ['Name', 'Phone', 'Email', 'Passenger Count'];
        csvData = report.data.map(item => ({
          name: item.name,
          phone: item.phone,
          email: item.email,
          passengercount: item.passengerCount
        }));
        break;
      case 'dietary':
        headers = ['Name', 'Dietary Requirements', 'Passenger Count', 'Additional Passengers'];
        csvData = report.data.map(item => ({
          name: item.name,
          dietaryrequirements: item.dietary,
          passengercount: item.passengerCount,
          additionalpassengers: item.additionalPassengers.join(', ')
        }));
        break;
      case 'summary':
        headers = ['Lead Passenger', 'Additional Passengers', 'Passenger Count', 'Check In', 'Check Out', 'Nights', 'Status', 'Group Name', 'Notes'];
        csvData = report.data.map(item => ({
          leadpassenger: item.leadPassenger,
          additionalpassengers: item.additionalPassengers.join(', '),
          passengercount: item.passengerCount,
          checkin: item.checkIn,
          checkout: item.checkOut,
          nights: item.nights,
          status: item.status,
          groupname: item.groupName,
          notes: item.notes
        }));
        break;
      case 'hotel':
        headers = ['Room', 'Guest Name', 'Check In', 'Check Out', 'Nights', 'Room Type', 'Special Requests'];
        csvData = report.data.map(item => ({
          room: item.room,
          guestname: item.guestName,
          checkin: item.checkIn,
          checkout: item.checkOut,
          nights: item.nights,
          roomtype: item.roomType,
          specialrequests: item.specialRequests
        }));
        break;
    }

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => {
        const value = row[header.toLowerCase().replace(/\s+/g, '')] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tourName}_${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
  };

  const printReport = (report: ReportItem) => {
    let tableHTML = '';
    
    switch (report.type) {
      case 'contacts':
        tableHTML = `
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Passengers</th></tr></thead>
            <tbody>
              ${report.data.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.phone}</td>
                  <td>${item.email}</td>
                  <td>${item.passengerCount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        break;
      case 'dietary':
        tableHTML = `
          <table>
            <thead><tr><th>Name</th><th>Dietary Requirements</th><th>Passengers</th><th>Additional Passengers</th></tr></thead>
            <tbody>
              ${report.data.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.dietary}</td>
                  <td>${item.passengerCount}</td>
                  <td>${item.additionalPassengers.join(', ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        break;
      case 'summary':
        tableHTML = `
          <table>
            <thead><tr><th>Lead Passenger</th><th>Additional Passengers</th><th>Pax</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Status</th><th>Group</th><th>Notes</th></tr></thead>
            <tbody>
              ${report.data.map(item => `
                <tr>
                  <td>${item.leadPassenger}</td>
                  <td>${item.additionalPassengers.join(', ')}</td>
                  <td>${item.passengerCount}</td>
                  <td>${item.checkIn}</td>
                  <td>${item.checkOut}</td>
                  <td>${item.nights}</td>
                  <td><span class="status ${item.status}">${item.status.toUpperCase()}</span></td>
                  <td>${item.groupName}</td>
                  <td>${item.notes}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        break;
      case 'hotel':
        tableHTML = `
          <table>
            <thead><tr><th>Room</th><th>Guest Name</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Special Requests</th></tr></thead>
            <tbody>
              ${report.data.map(item => `
                <tr>
                  <td>${item.room}</td>
                  <td>${item.guestName}</td>
                  <td>${item.checkIn}</td>
                  <td>${item.checkOut}</td>
                  <td>${item.nights}</td>
                  <td>${item.specialRequests}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        break;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${report.title} - ${tourName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
              .status.paid { background-color: #dcfce7; color: #166534; }
              .status.deposited { background-color: #dbeafe; color: #1e40af; }
              .status.invoiced { background-color: #fef3c7; color: #92400e; }
              .status.pending { background-color: #f3f4f6; color: #374151; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <h1>${report.title} - ${tourName}</h1>
            ${tableHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const renderReportTable = (report: ReportItem) => {
    switch (report.type) {
      case 'contacts':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Passengers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.phone || '-'}</TableCell>
                  <TableCell>{item.email || '-'}</TableCell>
                  <TableCell>{item.passengerCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'dietary':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dietary Requirements</TableHead>
                <TableHead>Passengers</TableHead>
                <TableHead>Additional Passengers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.dietary}</TableCell>
                  <TableCell>{item.passengerCount}</TableCell>
                  <TableCell>{item.additionalPassengers.join(', ') || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'summary':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Passenger</TableHead>
                <TableHead>Additional Passengers</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Nights</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.leadPassenger}</TableCell>
                  <TableCell>{item.additionalPassengers.join(', ') || '-'}</TableCell>
                  <TableCell>{item.passengerCount}</TableCell>
                  <TableCell>{item.checkIn}</TableCell>
                  <TableCell>{item.checkOut}</TableCell>
                  <TableCell>{item.nights}</TableCell>
                  <TableCell>
                    <Badge className={`
                      ${item.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                      ${item.status === 'deposited' ? 'bg-blue-100 text-blue-800' : ''}
                      ${item.status === 'invoiced' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${item.status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
                    `}>
                      {item.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.groupName || '-'}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={item.notes}>
                      {item.notes || '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'hotel':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Guest Name</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Nights</TableHead>
                <TableHead>Special Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.room}</TableCell>
                  <TableCell>{item.guestName}</TableCell>
                  <TableCell>{item.checkIn}</TableCell>
                  <TableCell>{item.checkOut}</TableCell>
                  <TableCell>{item.nights}</TableCell>
                  <TableCell>{item.specialRequests || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      default:
        return null;
    }
  };

  // If showing individual report
  if (displayReport) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {displayReport.icon}
                <DialogTitle>{displayReport.title}</DialogTitle>
                <Badge variant="secondary">{displayReport.count} items</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => exportReportToCSV(displayReport)}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button 
                  onClick={() => printReport(displayReport)}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Print/PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{displayReport.description}</span>
            </div>
            
            <div className="border rounded-lg">
              {renderReportTable(displayReport)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Fallback to full management view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tour Operations Reports - {tourName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-600">Click on individual report types in the Operations tab to view specific reports.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
