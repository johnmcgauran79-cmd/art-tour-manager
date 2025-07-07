import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useBookingSearch } from "@/hooks/useBookingSearch";
import { EditBookingModal } from "./EditBookingModal";
import { formatDateToDDMMYYYY } from "@/lib/utils";

const getStatusColor = (status: string) => {
  switch (status) {
    case "fully_paid": return "bg-green-100 text-green-800";
    case "instalment_paid": return "bg-purple-100 text-purple-800";
    case "deposited": return "bg-blue-100 text-blue-800";
    case "invoiced": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "waitlisted": return "bg-orange-100 text-orange-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface BookingsTableProps {
  onAddBooking: () => void;
}

export const BookingsTable = ({ onAddBooking }: BookingsTableProps) => {
  const [showEditBooking, setShowEditBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: searchResults, isLoading } = useBookingSearch(searchQuery, 100);
  const bookings = searchResults?.data || [];
  const totalCount = searchResults?.count || 0;

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
            Search across all bookings in the system
          </CardDescription>
          <div className="flex items-center space-x-2 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by passenger name, tour, or group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No bookings found matching your search." : "Loading bookings..."}
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
                    <TableHead className="w-[100px]">Created</TableHead>
                    <TableHead className="w-[100px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
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
