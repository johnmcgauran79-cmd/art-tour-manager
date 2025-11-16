import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Search, Save, ChevronLeft, ChevronRight, Filter, AlertTriangle } from "lucide-react";
import { usePaginatedBookings, useFilteredBookings, useFilterCounts, useUpdateBooking } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
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

// Define problematic status transitions
const PROBLEMATIC_TRANSITIONS: Record<string, string[]> = {
  'fully_paid': ['pending', 'invoiced', 'deposited', 'instalment_paid'],
  'deposited': ['pending', 'invoiced'],
  'instalment_paid': ['pending', 'invoiced', 'deposited'],
  'cancelled': ['fully_paid', 'deposited', 'instalment_paid'],
};

export default function BulkBookingStatus() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusUpdates, setStatusUpdates] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tourFilter, setTourFilter] = useState<string>("all");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Array<{ id: string; oldStatus: string; newStatus: string; passengerName: string }>>([]);
  const pageSize = 50;
  
  const { data: paginatedData, isLoading: paginatedLoading } = usePaginatedBookings(currentPage, pageSize);
  const { data: filteredData, isLoading: filteredLoading } = useFilteredBookings(
    activeFilter === 'all' ? null : activeFilter,
    currentPage,
    pageSize
  );
  const { data: filterCounts } = useFilterCounts();
  const { data: tours } = useTours();
  
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

  // Filter bookings based on search query, status filter, and tour filter with useMemo for performance
  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // Apply tour filter
    if (tourFilter !== "all") {
      filtered = filtered.filter(booking => booking.tour_id === tourFilter);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(booking => booking.status === statusFilter);
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
  }, [bookings, searchQuery, statusFilter, tourFilter]);

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

  // Handle bulk update with confirmation
  const handleBulkUpdate = () => {
    const updates: Array<{ id: string; oldStatus: string; newStatus: string; passengerName: string }> = [];
    
    filteredBookings.forEach(booking => {
      if (selectedBookings.has(booking.id) && bulkStatus) {
        const passengerName = booking.customers 
          ? `${booking.customers.first_name} ${booking.customers.last_name}`
          : booking.group_name || 'Unknown';
        
        updates.push({
          id: booking.id,
          oldStatus: booking.status || 'pending',
          newStatus: bulkStatus,
          passengerName
        });
      }
    });

    if (updates.length === 0) {
      toast({
        title: "No Changes",
        description: "Please select bookings and a status to update.",
        variant: "destructive",
      });
      return;
    }

    setPendingUpdates(updates);
    setShowConfirmDialog(true);
  };

  // Check if there are problematic transitions
  const hasProblematicTransitions = useMemo(() => {
    return pendingUpdates.some(update => {
      const problematicTargets = PROBLEMATIC_TRANSITIONS[update.oldStatus] || [];
      return problematicTargets.includes(update.newStatus);
    });
  }, [pendingUpdates]);

  // Get warning message for problematic transitions
  const getWarningMessage = useMemo(() => {
    const problematic = pendingUpdates.filter(update => {
      const problematicTargets = PROBLEMATIC_TRANSITIONS[update.oldStatus] || [];
      return problematicTargets.includes(update.newStatus);
    });

    if (problematic.length === 0) return null;

    return `${problematic.length} booking(s) have potentially problematic status changes (e.g., moving from '${formatStatusText(problematic[0].oldStatus)}' to '${formatStatusText(problematic[0].newStatus)}'). Please verify this is intentional.`;
  }, [pendingUpdates]);

  // Execute bulk update after confirmation
  const executeBulkUpdate = async () => {
    let successCount = 0;
    let errorCount = 0;

    for (const update of pendingUpdates) {
      try {
        await updateBooking.mutateAsync({
          id: update.id,
          status: update.newStatus as any,
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to update booking ${update.id}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Bulk Update Complete",
        description: `Successfully updated ${successCount} booking(s)${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
      });
    }

    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Update Failed",
        description: `Failed to update ${errorCount} booking(s). Please try again.`,
        variant: "destructive",
      });
    }

    // Clear selections and close dialog
    setSelectedBookings(new Set());
    setBulkStatus("");
    setShowConfirmDialog(false);
    setPendingUpdates([]);
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

          <div className="mb-4 space-y-4">
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

            {/* Search, Tour Filter, and Status Filter */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by passenger name, tour name, or group name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={tourFilter} onValueChange={setTourFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by tour" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tours</SelectItem>
                  {tours?.map((tour) => (
                    <SelectItem key={tour.id} value={tour.id}>
                      {tour.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {BOOKING_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatStatusText(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Status Update</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to update {pendingUpdates.length} booking(s) to status: <strong>{formatStatusText(bulkStatus)}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {/* Warning for problematic transitions */}
            {hasProblematicTransitions && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {getWarningMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Summary of changes */}
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <h4 className="font-semibold mb-3">Changes to be applied:</h4>
              <div className="space-y-2">
                {pendingUpdates.map((update, index) => {
                  const isProblematic = PROBLEMATIC_TRANSITIONS[update.oldStatus]?.includes(update.newStatus);
                  return (
                    <div 
                      key={update.id} 
                      className={`flex items-center justify-between p-2 rounded ${isProblematic ? 'bg-destructive/10' : 'bg-muted'}`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {isProblematic && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        <span className="text-sm">{index + 1}. {update.passengerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getBookingStatusColor(update.oldStatus)}>
                          {formatStatusText(update.oldStatus)}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className={getBookingStatusColor(update.newStatus)}>
                          {formatStatusText(update.newStatus)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status transition summary */}
            <div className="text-sm text-muted-foreground">
              <p>Summary: {pendingUpdates.length} booking(s) will be updated</p>
              {hasProblematicTransitions && (
                <p className="text-destructive font-medium mt-1">
                  ⚠️ Some transitions may require additional verification
                </p>
              )}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeBulkUpdate}
              className={hasProblematicTransitions ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {hasProblematicTransitions ? 'Update Anyway' : 'Confirm Update'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
