
import { useState } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, Search, TrendingUp, FileText, RefreshCw, Loader2 } from "lucide-react";
import { InvoiceSyncProgressModal } from "@/components/InvoiceSyncProgressModal";
import { useBookings, useFilterCounts } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";
import { BookingCard } from "@/components/cards/BookingCard";
import { ViewToggle } from "@/components/ViewToggle";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";
import { BulkInvoiceReferenceModal } from "@/components/BulkInvoiceReferenceModal";
import { InvoiceSyncReviewModal } from "@/components/InvoiceSyncReviewModal";
import { useToast } from "@/hooks/use-toast";

interface BookingsTableProps {
  onAddBooking: () => void;
  onViewAnalytics?: () => void;
  onBulkStatusUpdate?: () => void;
}

export const BookingsTable = ({ onAddBooking, onViewAnalytics, onBulkStatusUpdate }: BookingsTableProps) => {
  const { navigateWithContext } = useNavigationContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<'grid' | 'table'>('table');
  const { data: allBookings = [], isLoading } = useBookings();
  const { isViewOnly, hasEditAccess } = usePermissions();
  const [invoiceRefModalOpen, setInvoiceRefModalOpen] = useState(false);
  const [isSyncingInvoices, setIsSyncingInvoices] = useState(false);
  const [showSyncReviewModal, setShowSyncReviewModal] = useState(false);
  const [invoiceProposals, setInvoiceProposals] = useState<any[]>([]);
  const [totalChecked, setTotalChecked] = useState(0);
  const { toast } = useToast();
  const { data: filterCounts } = useFilterCounts();
  
  // Calculate combined count for deposits owing, instalments owing, and final payments due
  const statusUpdateCount = (filterCounts?.depositsOwing || 0) + (filterCounts?.instalmentsOwing || 0) + (filterCounts?.paymentDue || 0);

  // Calculate bookings this month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const bookingsThisMonth = (allBookings || []).filter(booking => {
    const bookingDate = new Date(booking.created_at);
    return bookingDate.getMonth() === currentMonth && 
           bookingDate.getFullYear() === currentYear &&
           booking.status !== 'cancelled';
  }).length;

  // Filter all bookings based on search query
  const filteredBookings = (allBookings || []).filter(booking => {
    if (!searchQuery.trim()) return true;
    const searchTerm = searchQuery.toLowerCase();
    
    // Search in customer names, tour names, group names, and passenger names
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

  const handleBookingClick = (booking: any) => {
    navigateWithContext(`/bookings/${booking.id}`);
  };

  const handleSyncInvoices = async () => {
    setIsSyncingInvoices(true);
    try {
      const response = await fetch(
        `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/xero-webhook?action=preview-invoices`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Preview failed');
      setInvoiceProposals(result.proposals || []);
      setTotalChecked(result.total_checked || 0);
      setShowSyncReviewModal(true);
    } catch (error: any) {
      console.error('Error previewing invoices:', error);
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncingInvoices(false);
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

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          {/* Title and count - stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span className="text-lg sm:text-xl">All Bookings ({filteredBookings.length})</span>
              <Badge variant="secondary" className="text-xs sm:text-sm">
                {bookingsThisMonth} this month
              </Badge>
            </CardTitle>
            
            {/* Action buttons - wrap on mobile */}
            <div className="flex flex-wrap gap-2">
              {onViewAnalytics && !isViewOnly && (
                <Button 
                  onClick={onViewAnalytics} 
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  <TrendingUp className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Analytics</span>
                </Button>
              )}
              {onBulkStatusUpdate && !isViewOnly && (
                <PermissionButton 
                  resource="booking"
                  action="edit"
                  onClick={onBulkStatusUpdate} 
                  size="sm"
                  className="bg-brand-yellow hover:bg-brand-yellow/90 text-brand-navy relative text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Update Status</span>
                  <span className="sm:hidden">Status</span>
                  {statusUpdateCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-1 sm:ml-2 px-1.5 py-0.5 text-xs"
                    >
                      {statusUpdateCount}
                    </Badge>
                  )}
                </PermissionButton>
              )}
              {!isViewOnly && (
                <PermissionButton
                  resource="booking"
                  action="edit"
                  onClick={() => setInvoiceRefModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5 text-xs sm:text-sm"
                >
                  <FileText className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Update Invoice</span>
                  <span className="sm:hidden">Invoice</span>
                </PermissionButton>
              )}
              {!isViewOnly && (
                <PermissionButton
                  resource="booking"
                  action="edit"
                  onClick={handleSyncInvoices}
                  variant="outline"
                  size="sm"
                  disabled={isSyncingInvoices}
                  className="border-green-600/30 text-green-700 hover:bg-green-500/5 text-xs sm:text-sm"
                >
                  {isSyncingInvoices ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
                  ) : (
                    <RefreshCw className="h-4 w-4 sm:mr-1.5" />
                  )}
                  <span className="hidden sm:inline">Sync Invoice</span>
                  <span className="sm:hidden">Sync</span>
                </PermissionButton>
              )}
              {!isViewOnly && (
                <PermissionButton 
                  resource="booking"
                  action="create"
                  onClick={onAddBooking} 
                  size="sm"
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow text-xs sm:text-sm"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Booking</span>
                </PermissionButton>
              )}
            </div>
          </div>
          
          <CardDescription className="text-xs sm:text-sm">
            Search across all bookings in the system
          </CardDescription>
          
          {/* Search and view toggle - stacks on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search passenger, tour, group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <ViewToggle view={view} onViewChange={setView} />
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="whitespace-nowrap"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No bookings found matching your search." : "No bookings found."}
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onView={handleBookingClick}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Mobile card view for table mode on small screens */}
              <div className="block md:hidden space-y-3">
                {filteredBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onView={handleBookingClick}
                  />
                ))}
              </div>
              
              {/* Desktop table view */}
              <div className="hidden md:block border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Tour</TableHead>
                      <TableHead className="min-w-[120px]">Lead Passenger</TableHead>
                      <TableHead className="min-w-[120px]">Other Passengers</TableHead>
                      <TableHead className="min-w-[50px]">Pax</TableHead>
                      <TableHead className="min-w-[90px]">Check In</TableHead>
                      <TableHead className="min-w-[90px]">Check Out</TableHead>
                      <TableHead className="min-w-[60px]">Nights</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[90px]">Created</TableHead>
                      <TableHead className="min-w-[120px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow 
                        key={booking.id} 
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleBookingClick(booking)}
                      >
                        <TableCell className="font-medium">{booking.tours?.name || 'No Tour'}</TableCell>
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
                          {booking.accommodation_required ? formatDateToDDMMYYYY(booking.check_in_date) : 'NA'}
                        </TableCell>
                        <TableCell>
                          {booking.accommodation_required ? formatDateToDDMMYYYY(booking.check_out_date) : 'NA'}
                        </TableCell>
                        <TableCell>{booking.total_nights || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getBookingStatusColor(booking.status || 'pending')}>
                            {formatStatusText(booking.status || 'pending')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDateToDDMMYYYY(booking.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="truncate max-w-[150px]" title={(booking as any).booking_notes || ''}>
                            {(booking as any).booking_notes || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <BulkInvoiceReferenceModal
        open={invoiceRefModalOpen}
        onOpenChange={setInvoiceRefModalOpen}
      />

      <InvoiceSyncProgressModal open={isSyncingInvoices} />

      <InvoiceSyncReviewModal
        open={showSyncReviewModal}
        onClose={() => setShowSyncReviewModal(false)}
        proposals={invoiceProposals}
        totalChecked={totalChecked}
        onApplyComplete={() => {}}
      />
    </>
  );
};
