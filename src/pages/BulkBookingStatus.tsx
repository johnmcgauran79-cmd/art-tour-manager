import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Save, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { usePaginatedBookings, useFilteredBookings, useFilterCounts, useUpdateBooking } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";
import { useToast } from "@/hooks/use-toast";
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
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const pageSize = 50;
  
  const { data: paginatedData, isLoading: paginatedLoading } = usePaginatedBookings(currentPage, pageSize);
  const { data: filteredData, isLoading: filteredLoading } = useFilteredBookings(
    activeFilter === 'all' ? null : activeFilter,
    currentPage,
    pageSize
  );
  const { data: filterCounts } = useFilterCounts();
  
  const updateBooking = useUpdateBooking();
  const { toast } = useToast();

  // Use filtered data when filter is active, otherwise use paginated data
  const currentData = activeFilter === 'all' ? paginatedData : filteredData;
  const isLoading = activeFilter === 'all' ? paginatedLoading : filteredLoading;
  
  const bookings = currentData?.data || [];
  const totalCount = currentData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Reset to page 1 when filter changes
  const handleFilterChange = (filter: FilterType) => {
    setCurrentPage(1);
    setActiveFilter(filter);
    setSelectedBookings(new Set());
    setBulkStatus("");
  };

  // Filter bookings based on search query with useMemo for performance
  const filteredBookings = useMemo(() => {
    let filtered = bookings;

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
  }, [bookings, searchQuery]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredBookings.map(b => b.id));
      setSelectedBookings(allIds);
    } else {
      setSelectedBookings(new Set());
    }
  };

  const handleSelectBooking = (bookingId: string, checked: boolean) => {
    const newSelected = new Set(selectedBookings);
    if (checked) {
      newSelected.add(bookingId);
    } else {
      newSelected.delete(bookingId);
    }
    setSelectedBookings(newSelected);
  };

  const isAllSelected = filteredBookings.length > 0 && 
    filteredBookings.every(b => selectedBookings.has(b.id));
  const isSomeSelected = selectedBookings.size > 0 && !isAllSelected;

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

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedBookings.size === 0) {
      toast({
        title: "No Changes",
        description: "Please select bookings and a status to update.",
      });
      return;
    }

    const bookingsToUpdate = Array.from(selectedBookings).filter(bookingId => {
      const booking = bookings.find(b => b.id === bookingId);
      return booking && booking.status !== bulkStatus;
    });

    if (bookingsToUpdate.length === 0) {
      toast({
        title: "No Changes",
        description: "Selected bookings already have this status.",
      });
      return;
    }

    try {
      await Promise.all(
        bookingsToUpdate.map(bookingId =>
          updateBooking.mutateAsync({
            id: bookingId,
            status: bulkStatus as any
          })
        )
      );

      toast({
        title: "Bulk Update Complete",
        description: `Successfully updated ${bookingsToUpdate.length} booking${bookingsToUpdate.length > 1 ? 's' : ''}.`,
      });

      // Clear selections and bulk status
      setSelectedBookings(new Set());
      setBulkStatus("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update some bookings. Please try again.",
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
          {/* Bulk Update Section */}
          {selectedBookings.size > 0 && (
            <div className="mb-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedBookings.size} booking{selectedBookings.size > 1 ? 's' : ''} selected
                </span>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatStatusText(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleBulkUpdate}
                  disabled={!bulkStatus || updateBooking.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Update Selected
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedBookings(new Set());
                    setBulkStatus("");
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          <div className="mb-4 space-y-4">....
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('all')}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                All Bookings
              </Button>
              <Button
                variant={activeFilter === 'deposits_owing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('deposits_owing')}
              >
                Deposits Owing ({filterCounts?.depositsOwing || 0})
              </Button>
              <Button
                variant={activeFilter === 'payment_due' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('payment_due')}
              >
                Final Payment Due ({filterCounts?.paymentDue || 0})
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
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all bookings"
                      className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                    />
                  </TableHead>
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {searchQuery ? 'No bookings found matching your search.' : 'No bookings available.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedBookings.has(booking.id)}
                          onCheckedChange={(checked) => handleSelectBooking(booking.id, checked as boolean)}
                          aria-label={`Select ${booking.customers?.first_name} ${booking.customers?.last_name}`}
                        />
                      </TableCell>
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
