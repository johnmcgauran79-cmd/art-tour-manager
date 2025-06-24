import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 50;
  
  const { data: paginatedData, isLoading } = usePaginatedBookings(currentPage, pageSize);
  const bookings = paginatedData?.data || [];
  const totalCount = paginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Filter bookings based on search query
  const filteredBookings = bookings.filter(booking => {
    if (!searchQuery) return true;
    const leadPassengerName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.toLowerCase();
    return leadPassengerName.includes(searchQuery.toLowerCase());
  });

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
            <Button onClick={onAddBooking} className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow">
              <Plus className="h-4 w-4 mr-2" />
              Add Booking
            </Button>
          </CardTitle>
          <CardDescription>
            Complete list of all bookings from most recent to oldest
          </CardDescription>
          <div className="flex items-center space-x-2 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by lead passenger name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No bookings found matching your search." : "No bookings found. Create your first booking to get started!"}
            </div>
          ) : (
            <>
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
                      <TableHead className="w-[100px]">Created</TableHead>
                      <TableHead className="w-[100px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
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
                            {(booking.status || 'pending').replace("_", " ").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-[100px]">
                          {formatDateToDDMMYYYY(booking.created_at)}
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

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {searchQuery ? (
                    `Showing ${filteredBookings.length} of ${totalCount} bookings`
                  ) : (
                    `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} bookings`
                  )}
                </div>
                {!searchQuery && (
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
                )}
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
