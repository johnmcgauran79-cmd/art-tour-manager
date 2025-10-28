import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";

const getStatusColor = (status: string) => {
  switch (status) {
    case "fully_paid": return "bg-green-100 text-green-800";
    case "instalment_paid": return "bg-purple-100 text-purple-800";
    case "deposited": return "bg-blue-100 text-blue-800";
    case "invoiced": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface RecentBookingsProps {
  onAddBooking: () => void;
  onViewAllBookings?: () => void;
}

export const RecentBookings = ({ onAddBooking, onViewAllBookings }: RecentBookingsProps) => {
  const navigate = useNavigate();
  const { data: bookings, isLoading } = useBookings();

  const handleBookingClick = (booking: any) => {
    navigate(`/bookings/${booking.id}`);
  };

  const handleViewAll = () => {
    if (onViewAllBookings) {
      onViewAllBookings();
    } else {
      // Trigger navigation to bookings tab by dispatching a custom event
      window.dispatchEvent(new CustomEvent('navigate-to-bookings'));
    }
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
              <Button onClick={handleViewAll} variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View All
              </Button>
              <Button onClick={onAddBooking} className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow">
                <Plus className="h-4 w-4 mr-2" />
                Add Booking
              </Button>
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
                    <TableHead className="w-[140px]">Tour</TableHead>
                    <TableHead className="w-[120px]">Lead Passenger</TableHead>
                    <TableHead className="w-[120px]">Other Passengers</TableHead>
                    <TableHead className="w-[60px]">Pax</TableHead>
                    <TableHead className="w-[100px]">Check In</TableHead>
                    <TableHead className="w-[100px]">Check Out</TableHead>
                    <TableHead className="w-[70px]">Nights</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[100px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map((booking) => (
                    <TableRow 
                      key={booking.id} 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleBookingClick(booking)}
                    >
                      <TableCell className="w-[140px]">{booking.tours?.name || 'No Tour'}</TableCell>
                      <TableCell className="w-[120px]">
                        {booking.customers?.first_name} {booking.customers?.last_name}
                      </TableCell>
                      <TableCell className="w-[120px]">
                        <div className="space-y-1">
                          {booking.passenger_2_name && <div>{booking.passenger_2_name}</div>}
                          {booking.passenger_3_name && <div>{booking.passenger_3_name}</div>}
                          {booking.group_name && <div className="text-sm text-muted-foreground">Group: {booking.group_name}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="w-[60px]">{booking.passenger_count}</TableCell>
                      <TableCell className="w-[100px]">
                        {formatDateToDDMMYYYY(booking.check_in_date)}
                      </TableCell>
                      <TableCell className="w-[100px]">
                        {formatDateToDDMMYYYY(booking.check_out_date)}
                      </TableCell>
                      <TableCell className="w-[70px]">{booking.total_nights || '-'}</TableCell>
                      <TableCell className="w-[80px]">
                        <Badge className={getStatusColor(booking.status || 'pending')}>
                          {(booking.status || 'pending').replace("_", " ").replace("fully paid", "FULLY PAID").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[100px]">
                        <div className="truncate" title={booking.extra_requests || ''}>
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
    </>
  );
};
