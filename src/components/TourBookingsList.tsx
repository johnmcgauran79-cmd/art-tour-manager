
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { AddBookingModal } from "@/components/AddBookingModal";
import { EditBookingModal } from "@/components/EditBookingModal";
import { formatDateToDDMMYYYY } from "@/lib/utils";

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "deposited": return "bg-blue-100 text-blue-800";
    case "invoiced": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface TourBookingsListProps {
  tourId: string;
  tourName: string;
}

export const TourBookingsList = ({ tourId, tourName }: TourBookingsListProps) => {
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [editBookingModalOpen, setEditBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const { data: allBookings, isLoading } = useBookings();

  const handleEditBooking = (booking: any) => {
    setSelectedBooking(booking);
    setEditBookingModalOpen(true);
  };

  const handleDeleteBooking = (booking: any) => {
    if (confirm(`Are you sure you want to delete booking for ${booking.customers?.first_name} ${booking.customers?.last_name}?`)) {
      // Delete functionality would be handled by the EditBookingModal
      setSelectedBooking(booking);
      setEditBookingModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading bookings...</div>
        </CardContent>
      </Card>
    );
  }

  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tourId);

  return (
    <>
      {tourBookings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No bookings found for this tour. Add the first booking to get started!
        </div>
      ) : (
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
                <th className="text-left p-3 font-medium">Notes</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tourBookings.map((booking) => (
                <tr key={booking.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    {booking.customers?.first_name} {booking.customers?.last_name}
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {booking.passenger_2_name && <div>{booking.passenger_2_name}</div>}
                      {booking.passenger_3_name && <div>{booking.passenger_3_name}</div>}
                      {booking.group_name && <div className="text-sm text-gray-500">Group: {booking.group_name}</div>}
                    </div>
                  </td>
                  <td className="p-3">{booking.passenger_count}</td>
                  <td className="p-3">{formatDateToDDMMYYYY(booking.check_in_date)}</td>
                  <td className="p-3">{formatDateToDDMMYYYY(booking.check_out_date)}</td>
                  <td className="p-3">{booking.total_nights || '-'}</td>
                  <td className="p-3">
                    <Badge className={getStatusColor(booking.status || 'pending')}>
                      {(booking.status || 'pending').replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="p-3 max-w-xs">
                    <div className="truncate" title={booking.extra_requests || ''}>
                      {booking.extra_requests || '-'}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditBooking(booking)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteBooking(booking)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddBookingModal 
        open={showAddBooking} 
        onOpenChange={setShowAddBooking} 
        preSelectedTourId={tourId}
      />

      {selectedBooking && (
        <EditBookingModal
          booking={selectedBooking}
          open={editBookingModalOpen}
          onOpenChange={setEditBookingModalOpen}
        />
      )}
    </>
  );
};
