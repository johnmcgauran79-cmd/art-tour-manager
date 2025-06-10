
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { usePaginatedBookings } from "@/hooks/useBookings";
import { EditBookingModal } from "./EditBookingModal";
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

interface BookingsTableProps {
  onAddBooking: () => void;
}

export const BookingsTable = ({ onAddBooking }: BookingsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showEditBooking, setShowEditBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const pageSize = 50;
  
  const { data: paginatedData, isLoading } = usePaginatedBookings(currentPage, pageSize);
  const bookings = paginatedData?.data || [];
  const totalCount = paginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setShowEditBooking(true);
  };

  if (isLoading && bookings.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading bookings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            All Bookings ({totalCount} total)
            <Button onClick={onAddBooking} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Booking
            </Button>
          </CardTitle>
          <CardDescription>
            Complete list of all bookings from most recent to oldest
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bookings found. Create your first booking to get started!
            </div>
          ) : (
            <>
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
                      <TableHead>Agent</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
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
                          {formatDateToDDMMYYYY(booking.check_in_date)}
                        </TableCell>
                        <TableCell>
                          {formatDateToDDMMYYYY(booking.check_out_date)}
                        </TableCell>
                        <TableCell>{booking.total_nights || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(booking.status || 'pending')}>
                            {(booking.status || 'pending').replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{booking.booking_agent || '-'}</TableCell>
                        <TableCell>
                          {formatDateToDDMMYYYY(booking.created_at)}
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

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} bookings
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EditBookingModal 
        booking={selectedBooking} 
        open={showEditBooking} 
        onOpenChange={setShowEditBooking} 
      />
    </>
  );
};
