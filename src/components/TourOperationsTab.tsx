
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Phone, Utensils, Hotel, Users } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useHotels } from "@/hooks/useHotels";
import { useHotelBookings } from "@/hooks/useHotelBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface TourOperationsTabProps {
  tourId: string;
  tourName: string;
}

export const TourOperationsTab = ({ tourId, tourName }: TourOperationsTabProps) => {
  const { data: allBookings } = useBookings();
  const { data: hotels } = useHotels(tourId);
  const [exportingPdf, setExportingPdf] = useState(false);

  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tourId && booking.status !== 'cancelled');

  // Get all dietary requirements
  const dietaryRequirements = tourBookings
    .map(booking => ({
      name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      dietary: booking.customers?.dietary_requirements || '',
      passengerCount: booking.passenger_count,
      additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean)
    }))
    .filter(item => item.dietary && item.dietary.trim() !== '');

  // Get contact list for WhatsApp export
  const contactList = tourBookings.map(booking => ({
    name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
    phone: booking.customers?.phone || '',
    email: booking.customers?.email || '',
    passengerCount: booking.passenger_count
  }));

  // Summary list of all passengers
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

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header.toLowerCase().replace(/\s+/g, '')] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tourName}_${filename}.csv`;
    link.click();
  };

  const exportContactsCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Passenger Count'];
    const data = contactList.map(contact => ({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      passengercount: contact.passengerCount
    }));
    exportToCSV(data, 'contacts', headers);
  };

  const exportDietaryCSV = () => {
    const headers = ['Name', 'Dietary Requirements', 'Passenger Count', 'Additional Passengers'];
    const data = dietaryRequirements.map(item => ({
      name: item.name,
      dietaryrequirements: item.dietary,
      passengercount: item.passengerCount,
      additionalpassengers: item.additionalPassengers.join(', ')
    }));
    exportToCSV(data, 'dietary_requirements', headers);
  };

  const exportSummaryCSV = () => {
    const headers = ['Lead Passenger', 'Additional Passengers', 'Passenger Count', 'Check In', 'Check Out', 'Nights', 'Status', 'Group Name', 'Notes'];
    const data = passengerSummary.map(item => ({
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
    exportToCSV(data, 'passenger_summary', headers);
  };

  const printReport = (title: string, content: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${tourName} - ${title}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              h2 { color: #666; margin-top: 30px; }
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
            <h1>${tourName}</h1>
            <h2>${title}</h2>
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Contact List for WhatsApp */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              <CardTitle>Contact List for WhatsApp</CardTitle>
              <Badge variant="secondary">{contactList.length} contacts</Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportContactsCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                onClick={() => printReport('Contact List', `
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Phone</th><th>Email</th><th>Passengers</th></tr>
                    </thead>
                    <tbody>
                      ${contactList.map(contact => `
                        <tr>
                          <td>${contact.name}</td>
                          <td>${contact.phone}</td>
                          <td>${contact.email}</td>
                          <td>${contact.passengerCount}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `)}
                variant="outline" 
                size="sm"
              >
                <FileText className="h-4 w-4 mr-2" />
                Print/PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Passengers</th>
                </tr>
              </thead>
              <tbody>
                {contactList.map((contact, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3">{contact.name}</td>
                    <td className="p-3">{contact.phone || '-'}</td>
                    <td className="p-3">{contact.email || '-'}</td>
                    <td className="p-3">{contact.passengerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dietary Requirements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-green-600" />
              <CardTitle>Dietary Requirements</CardTitle>
              <Badge variant="secondary">{dietaryRequirements.length} special diets</Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportDietaryCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                onClick={() => printReport('Dietary Requirements', `
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Dietary Requirements</th><th>Passengers</th><th>Additional Passengers</th></tr>
                    </thead>
                    <tbody>
                      ${dietaryRequirements.map(item => `
                        <tr>
                          <td>${item.name}</td>
                          <td>${item.dietary}</td>
                          <td>${item.passengerCount}</td>
                          <td>${item.additionalPassengers.join(', ')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `)}
                variant="outline" 
                size="sm"
              >
                <FileText className="h-4 w-4 mr-2" />
                Print/PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dietaryRequirements.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No special dietary requirements for this tour</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Dietary Requirements</th>
                    <th className="text-left p-3 font-medium">Passengers</th>
                    <th className="text-left p-3 font-medium">Additional Passengers</th>
                  </tr>
                </thead>
                <tbody>
                  {dietaryRequirements.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.dietary}</td>
                      <td className="p-3">{item.passengerCount}</td>
                      <td className="p-3">{item.additionalPassengers.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passenger Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <CardTitle>Passenger Summary</CardTitle>
              <Badge variant="secondary">{tourBookings.length} bookings</Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportSummaryCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                onClick={() => printReport('Passenger Summary', `
                  <table>
                    <thead>
                      <tr><th>Lead Passenger</th><th>Additional Passengers</th><th>Pax</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Status</th><th>Group</th><th>Notes</th></tr>
                    </thead>
                    <tbody>
                      ${passengerSummary.map(item => `
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
                `)}
                variant="outline" 
                size="sm"
              >
                <FileText className="h-4 w-4 mr-2" />
                Print/PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Lead Passenger</th>
                  <th className="text-left p-3 font-medium">Additional Passengers</th>
                  <th className="text-left p-3 font-medium">Pax</th>
                  <th className="text-left p-3 font-medium">Check In</th>
                  <th className="text-left p-3 font-medium">Check Out</th>
                  <th className="text-left p-3 font-medium">Nights</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Group</th>
                  <th className="text-left p-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {passengerSummary.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.leadPassenger}</td>
                    <td className="p-3">{item.additionalPassengers.join(', ') || '-'}</td>
                    <td className="p-3">{item.passengerCount}</td>
                    <td className="p-3">{item.checkIn}</td>
                    <td className="p-3">{item.checkOut}</td>
                    <td className="p-3">{item.nights}</td>
                    <td className="p-3">
                      <Badge className={`
                        ${item.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                        ${item.status === 'deposited' ? 'bg-blue-100 text-blue-800' : ''}
                        ${item.status === 'invoiced' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${item.status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
                      `}>
                        {item.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-3">{item.groupName || '-'}</td>
                    <td className="p-3 max-w-xs">
                      <div className="truncate" title={item.notes}>
                        {item.notes || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Hotel Rooming Lists */}
      {hotels && hotels.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-orange-600" />
              <CardTitle>Hotel Rooming Lists</CardTitle>
              <Badge variant="secondary">{hotels.length} hotels</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {hotels.map((hotel) => (
                <HotelRoomingList key={hotel.id} hotel={hotel} tourBookings={tourBookings} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const HotelRoomingList = ({ hotel, tourBookings }: { hotel: any, tourBookings: any[] }) => {
  const { data: hotelBookings } = useHotelBookings('');

  const hotelGuests = tourBookings.filter(booking => {
    return hotelBookings?.some(hb => hb.booking_id === booking.id && hb.hotel_id === hotel.id);
  });

  const exportHotelCSV = () => {
    const headers = ['Room', 'Guest Name', 'Check In', 'Check Out', 'Nights', 'Room Type', 'Special Requests'];
    const data = hotelGuests.map((guest, index) => ({
      room: `Room ${index + 1}`,
      guestname: `${guest.customers?.first_name} ${guest.customers?.last_name}`,
      checkin: formatDateToDDMMYYYY(guest.check_in_date),
      checkout: formatDateToDDMMYYYY(guest.check_out_date),
      nights: guest.total_nights || 0,
      roomtype: 'Standard', // This could be enhanced with actual room type data
      specialrequests: guest.extra_requests || ''
    }));

    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header.toLowerCase().replace(/\s+/g, '')] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${hotel.name}_rooming_list.csv`;
    link.click();
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-lg">{hotel.name}</h4>
        <div className="flex gap-2">
          <Button onClick={exportHotelCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button 
            onClick={() => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(`
                  <html>
                    <head>
                      <title>${hotel.name} - Rooming List</title>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; font-weight: bold; }
                      </style>
                    </head>
                    <body>
                      <h1>${hotel.name} - Rooming List</h1>
                      <table>
                        <thead>
                          <tr><th>Room</th><th>Guest Name</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Special Requests</th></tr>
                        </thead>
                        <tbody>
                          ${hotelGuests.map((guest, index) => `
                            <tr>
                              <td>Room ${index + 1}</td>
                              <td>${guest.customers?.first_name} ${guest.customers?.last_name}</td>
                              <td>${formatDateToDDMMYYYY(guest.check_in_date)}</td>
                              <td>${formatDateToDDMMYYYY(guest.check_out_date)}</td>
                              <td>${guest.total_nights || 0}</td>
                              <td>${guest.extra_requests || '-'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </body>
                  </html>
                `);
                printWindow.document.close();
                printWindow.print();
              }
            }}
            variant="outline" 
            size="sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>
      
      {hotelGuests.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No guests allocated to this hotel</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Room</th>
                <th className="text-left p-2 font-medium">Guest Name</th>
                <th className="text-left p-2 font-medium">Check In</th>
                <th className="text-left p-2 font-medium">Check Out</th>
                <th className="text-left p-2 font-medium">Nights</th>
                <th className="text-left p-2 font-medium">Special Requests</th>
              </tr>
            </thead>
            <tbody>
              {hotelGuests.map((guest, index) => (
                <tr key={guest.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">Room {index + 1}</td>
                  <td className="p-2">{guest.customers?.first_name} {guest.customers?.last_name}</td>
                  <td className="p-2">{formatDateToDDMMYYYY(guest.check_in_date)}</td>
                  <td className="p-2">{formatDateToDDMMYYYY(guest.check_out_date)}</td>
                  <td className="p-2">{guest.total_nights || 0}</td>
                  <td className="p-2">{guest.extra_requests || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
