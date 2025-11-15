import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Search, Save } from "lucide-react";
import { useBookings, useUpdateBooking } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const BOOKING_STATUSES = [
  'pending',
  'invoiced',
  'deposited',
  'instalment_paid',
  'fully_paid',
  'cancelled',
  'waitlisted',
  'host'
];

export default function BulkBookingStatus() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusUpdates, setStatusUpdates] = useState<Record<string, string>>({});
  const { data: allBookings = [], isLoading } = useBookings();
  const updateBooking = useUpdateBooking();
  const { toast } = useToast();

  // Filter bookings based on search query
  const filteredBookings = (allBookings || []).filter(booking => {
    if (!searchQuery.trim()) return true;
    const searchTerm = searchQuery.toLowerCase();
    
    const leadPassengerName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.toLowerCase();
    const passenger2Name = (booking.passenger_2_name || '').toLowerCase();
    const passenger3Name = (booking.passenger_3_name || '').toLowerCase();
    const groupName = (booking.group_name || '').toLowerCase();
    const tourName = (booking.tours?.name || '').toLowerCase();
    
    return leadPassengerName.includes(searchTerm) ||
           passenger2Name.includes(searchTerm) ||
           passenger3Name.includes(searchTerm) ||
           groupName.includes(searchTerm) ||
           tourName.includes(searchTerm);
  });

  const handleStatusChange = (bookingId: string, newStatus: string) => {
    setStatusUpdates(prev => ({
      ...prev,
      [bookingId]: newStatus
    }));
  };

  const handleUpdateStatus = async (bookingId: string) => {
    const newStatus = statusUpdates[bookingId];
    if (!newStatus) return;

    try {
      await updateBooking.mutateAsync({
        id: bookingId,
        status: newStatus as any
      });

      toast({
        title: "Status Updated",
        description: "Booking status has been updated successfully.",
      });

      // Clear the update for this booking
      setStatusUpdates(prev => {
        const newUpdates = { ...prev };
        delete newUpdates[bookingId];
        return newUpdates;
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update booking status. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading bookings...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/?tab=bookings")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bookings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Update Booking Status</span>
            <Badge variant="secondary">
              {filteredBookings.length} {searchQuery ? 'found' : 'bookings'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by passenger name, tour name, or group name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Tour</TableHead>
                  <TableHead>Booking Date</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>New Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {searchQuery ? 'No bookings found matching your search.' : 'No bookings available.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        {booking.customers?.first_name} {booking.customers?.last_name}
                        {booking.group_name && (
                          <div className="text-sm text-muted-foreground">
                            {booking.group_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{booking.tours?.name || 'N/A'}</TableCell>
                      <TableCell>{formatDateToDDMMYYYY(booking.created_at)}</TableCell>
                      <TableCell>
                        <Badge className={getBookingStatusColor(booking.status)}>
                          {formatStatusText(booking.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={statusUpdates[booking.id] || booking.status}
                          onValueChange={(value) => handleStatusChange(booking.id, value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BOOKING_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {formatStatusText(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(booking.id)}
                          disabled={!statusUpdates[booking.id] || statusUpdates[booking.id] === booking.status || updateBooking.isPending}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
