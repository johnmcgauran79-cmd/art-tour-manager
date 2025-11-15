import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Search, Save, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { usePaginatedBookings, useUpdateBooking } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";

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

type FilterType = 'all' | 'deposits_owing' | 'payment_due';

export default function BulkBookingStatus() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusUpdates, setStatusUpdates] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const pageSize = 50;
  const { data: paginatedData, isLoading } = usePaginatedBookings(currentPage, pageSize);
  const updateBooking = useUpdateBooking();
  const { toast } = useToast();

  const bookings = paginatedData?.data || [];
  const totalCount = paginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Calculate counts for each filter
  const depositsOwingCount = useMemo(() => {
    const filtered = bookings.filter(booking => {
      if (booking.status !== 'invoiced') return false;
      const daysSinceCreated = differenceInDays(new Date(), parseISO(booking.created_at));
      console.log('Deposits check:', {
        id: booking.id,
        status: booking.status,
        created_at: booking.created_at,
        daysSinceCreated,
        matches: daysSinceCreated > 14
      });
      return daysSinceCreated > 14;
    });
    console.log('Deposits Owing Count:', filtered.length, 'out of', bookings.length, 'bookings on this page');
    return filtered.length;
  }, [bookings]);

  const paymentDueCount = useMemo(() => {
    return bookings.filter(booking => {
      if (booking.status === 'fully_paid') return false;
      if (!booking.tours) return false;
      const tour = booking.tours as any;
      if (!tour.start_date) return false;
      const daysUntilTour = differenceInDays(parseISO(tour.start_date), new Date());
      return daysUntilTour < 80;
    }).length;
  }, [bookings]);

  // Filter bookings based on search query and active filter with useMemo for performance
  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // Apply auto-filter
    if (activeFilter === 'deposits_owing') {
      filtered = filtered.filter(booking => {
        if (booking.status !== 'invoiced') return false;
        const daysSinceCreated = differenceInDays(new Date(), parseISO(booking.created_at));
        return daysSinceCreated > 14;
      });
    } else if (activeFilter === 'payment_due') {
      filtered = filtered.filter(booking => {
        if (booking.status === 'fully_paid') return false;
        if (!booking.tours) return false;
        const tour = booking.tours as any;
        if (!tour.start_date) return false;
        const daysUntilTour = differenceInDays(parseISO(tour.start_date), new Date());
        return daysUntilTour < 80;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase();
      filtered = filtered.filter(booking => {
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
    }

    return filtered;
  }, [bookings, searchQuery, activeFilter]);

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

  const handleUpdateAll = async () => {
    const updates = Object.entries(statusUpdates).filter(([bookingId, newStatus]) => {
      const booking = bookings.find(b => b.id === bookingId);
      return booking && booking.status !== newStatus;
    });

    if (updates.length === 0) {
      toast({
        title: "No Changes",
        description: "No booking statuses have been changed.",
      });
      return;
    }

    try {
      await Promise.all(
        updates.map(([bookingId, newStatus]) =>
          updateBooking.mutateAsync({
            id: bookingId,
            status: newStatus as any
          })
        )
      );

      toast({
        title: "All Statuses Updated",
        description: `Successfully updated ${updates.length} booking${updates.length > 1 ? 's' : ''}.`,
      });

      // Clear all updates
      setStatusUpdates({});
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update some booking statuses. Please try again.",
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
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Page {currentPage} of {totalPages} • {totalCount} total bookings
              </Badge>
              {Object.keys(statusUpdates).length > 0 && (
                <Button
                  onClick={handleUpdateAll}
                  disabled={updateBooking.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Update All ({Object.keys(statusUpdates).length})
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-4">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                All Bookings
              </Button>
              <Button
                variant={activeFilter === 'deposits_owing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('deposits_owing')}
              >
                Deposits Owing ({depositsOwingCount})
              </Button>
              <Button
                variant={activeFilter === 'payment_due' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('payment_due')}
              >
                Final Payment Due ({paymentDueCount})
              </Button>
            </div>

            {/* Search Input */}
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

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} bookings
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
