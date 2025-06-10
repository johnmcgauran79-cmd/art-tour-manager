
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar, Eye } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { AllBookingsModal } from "./AllBookingsModal";
import { EditBookingModal } from "./EditBookingModal";

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

interface RecentBookingsProps {
  onAddBooking: () => void;
}

export const RecentBookings = ({ onAddBooking }: RecentBookingsProps) => {
  const [showAllBookings, setShowAllBookings] = useState(false);
  const [showEditBooking, setShowEditBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const { data: bookings, isLoading } = useBookings();

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setShowEditBooking(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading recent bookings...</div>
        </CardContent>
      </Card>
    );
  }

  const recentBookings = (bookings || []).slice(0, 5);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent Bookings
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowAllBookings(true)} variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View All
              </Button>
              <Button onClick={onAddBooking} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Booking
              </Button>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardTitle>
          <CardDescription>
            Latest 5 bookings in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bookings found. Create your first booking to get started!
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tour</TableHead>
                    <TableHead>Lead Passenger</TableHead>
                    <TableHead>Other Passengers</TableHead>
                    <TableHead>Pax</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map((booking) => (
                    <TableRow 
                      key={booking.id} 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleBookingClick(booking)}
                    >
                      <TableCell>{booking.tours?.name || 'No Tour'}</TableCell>
                      <TableCell>
                        {booking.customers?.first_name} {booking.customers?.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {booking.passenger_2_name && <div>{booking.passenger_2_name}</div>}
                          {booking.passenger_3_name && <div>{booking.passenger_3_name}</div>}
                          {booking.group_name && <div className="text-sm text-muted-foreground">Group: {booking.group_name}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{booking.passenger_count}</TableCell>
                      <TableCell>
                        {booking.check_in_date ? 
                          new Date(booking.check_in_date).toLocaleDateString() : 
                          'TBD'
                        }
                      </TableCell>
                      <TableCell>
                        {booking.check_out_date ? 
                          new Date(booking.check_out_date).toLocaleDateString() : 
                          'TBD'
                        }
                      </TableCell>
                      <TableCell>{booking.total_nights || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(booking.status || 'pending')}>
                          {(booking.status || 'pending').replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={booking.extra_requests || ''}>
                          {booking.extra_requests || '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AllBookingsModal 
        open={showAllBookings}
        onOpenChange={setShowAllBookings}
        onBookingClick={handleBookingClick}
      />

      <EditBookingModal 
        booking={selectedBooking} 
        open={showEditBooking} 
        onOpenChange={setShowEditBooking} 
      />
    </>
  );
};
