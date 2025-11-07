import { useState } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, Search, Users, Mail } from "lucide-react";
import { useBookings, useDeleteBooking } from "@/hooks/useBookings";
import { useSendBookingConfirmation } from "@/hooks/useBookingEmail";
import { EmailPreviewModal } from "@/components/EmailPreviewModal";
import { AddBookingModal } from "@/components/AddBookingModal";
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
    case "host": return "bg-emerald-100 text-emerald-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const getStatusOrder = (status: string) => {
  switch (status) {
    case "pending": return 1;
    case "invoiced": return 2;
    case "deposited": return 3;
    case "instalment_paid": return 4;
    case "fully_paid": return 5;
    case "host": return 6;
    case "waitlisted": return 7;
    case "cancelled": return 8;
    default: return 9;
  }
};

interface TourBookingsListProps {
  tourId: string;
  tourName: string;
  currentTab?: string;
}

export const TourBookingsList = ({ tourId, tourName, currentTab }: TourBookingsListProps) => {
  const { navigateWithContext } = useNavigationContext();
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [showAddWaitlist, setShowAddWaitlist] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showWaitlistOnly, setShowWaitlistOnly] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailBookingId, setEmailBookingId] = useState<string | null>(null);
  const { data: allBookings, isLoading } = useBookings();
  const deleteBookingMutation = useDeleteBooking();
  const sendBookingConfirmation = useSendBookingConfirmation();

  const handleViewBooking = (booking: any) => {
    console.log('[TourBookingsList] Navigating to booking with context:', {
      currentTab,
      tourId,
      from: `/tours/${tourId}`,
    });
    navigateWithContext(`/bookings/${booking.id}`, {
      state: {
        tab: currentTab,
        from: `/tours/${tourId}`,
      }
    });
  };

  const handleEditBooking = (e: React.MouseEvent, booking: any) => {
    e.stopPropagation();
    navigateWithContext(`/bookings/${booking.id}/edit`, {
      state: {
        tab: currentTab,
        from: `/tours/${tourId}`,
      }
    });
  };

  const handleDeleteBooking = (booking: any) => {
    const customerName = booking.customers?.first_name && booking.customers?.last_name 
      ? `${booking.customers.first_name} ${booking.customers.last_name}`
      : booking.group_name || 'this booking';
      
    if (confirm(`Are you sure you want to delete the booking for ${customerName}? This action cannot be undone.`)) {
      console.log('Deleting booking:', booking.id);
      deleteBookingMutation.mutate(booking.id);
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

  // Get all bookings for this tour
  const allTourBookings = (allBookings || [])
    .filter(booking => booking.tour_id === tourId);

  // Apply all filters
  const filteredBookings = allTourBookings
    .filter(booking => {
      // Search filter
      if (searchQuery.trim()) {
        const searchTerm = searchQuery.toLowerCase();
        const leadPassengerName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.toLowerCase();
        const passenger2Name = (booking.passenger_2_name || '').toLowerCase();
        const passenger3Name = (booking.passenger_3_name || '').toLowerCase();
        const groupName = (booking.group_name || '').toLowerCase();
        
        const matchesSearch = leadPassengerName.includes(searchTerm) ||
               passenger2Name.includes(searchTerm) ||
               passenger3Name.includes(searchTerm) ||
               groupName.includes(searchTerm);
        
        if (!matchesSearch) return false;
      }
      
      // Waitlist filter
      if (showWaitlistOnly && booking.status !== 'waitlisted') {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // First sort by status order
      const statusOrderA = getStatusOrder(a.status || 'pending');
      const statusOrderB = getStatusOrder(b.status || 'pending');
      
      if (statusOrderA !== statusOrderB) {
        return statusOrderA - statusOrderB;
      }
      
      // Within same status, sort by most recent booking (created_at descending)
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

  // Calculate statistics from all tour bookings (before filters)
  const confirmedBookings = allTourBookings.filter(b => b.status !== 'cancelled' && b.status !== 'waitlisted');
  const waitlistedBookings = allTourBookings.filter(b => b.status === 'waitlisted');
  const totalConfirmedPassengers = confirmedBookings.reduce((sum, b) => sum + b.passenger_count, 0);
  const totalWaitlistedPassengers = waitlistedBookings.reduce((sum, b) => sum + b.passenger_count, 0);

  return (
    <>
      {allTourBookings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No bookings found for this tour. Add the first booking to get started!
        </div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{confirmedBookings.length}</div>
                <div className="text-sm text-muted-foreground">Confirmed Bookings</div>
                <div className="text-xs text-muted-foreground">{totalConfirmedPassengers} passengers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">{waitlistedBookings.length}</div>
                <div className="text-sm text-muted-foreground">Waitlisted Bookings</div>
                <div className="text-xs text-muted-foreground">{totalWaitlistedPassengers} passengers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{allTourBookings.filter(b => b.status !== 'cancelled').length}</div>
                <div className="text-sm text-muted-foreground">Total Interest</div>
                <div className="text-xs text-muted-foreground">{totalConfirmedPassengers + totalWaitlistedPassengers} passengers</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search across all bookings for this tour..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant={showWaitlistOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowWaitlistOnly(!showWaitlistOnly)}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                {showWaitlistOnly ? "Show All" : "Waitlist Only"}
              </Button>
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
            <div className="text-sm text-muted-foreground">
              Showing {filteredBookings.length} of {allTourBookings.length} bookings
              {searchQuery && ` (filtered by: "${searchQuery}")`}
            </div>
          </div>
          
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? `No bookings found matching "${searchQuery}".` : "No bookings match the current filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Lead Passenger</th>
                    <th className="text-left p-3 font-medium">Additional Passengers</th>
                    <th className="text-left p-3 font-medium">Pax</th>
                    <th className="text-left p-3 font-medium">Check In</th>
                    <th className="text-left p-3 font-medium">Check Out</th>
                    <th className="text-left p-3 font-medium">Nights</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Notes</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr 
                      key={booking.id} 
                      className="border-b hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => handleViewBooking(booking)}
                    >
                      <td className="p-3">
                        {booking.customers?.first_name} {booking.customers?.last_name}
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {booking.passenger_2_name && <div>{booking.passenger_2_name}</div>}
                          {booking.passenger_3_name && <div>{booking.passenger_3_name}</div>}
                          {booking.group_name && <div className="text-sm text-gray-500">Group: {booking.group_name}</div>}
                        </div>
                      </td>
                      <td className="p-3">{booking.passenger_count}</td>
                      <td className="p-3">{booking.accommodation_required ? formatDateToDDMMYYYY(booking.check_in_date) : 'NA'}</td>
                      <td className="p-3">{booking.accommodation_required ? formatDateToDDMMYYYY(booking.check_out_date) : 'NA'}</td>
                      <td className="p-3">{booking.total_nights || '-'}</td>
                      <td className="p-3">
                        <Badge className={getStatusColor(booking.status || 'pending')}>
                          {(booking.status || 'pending').replace("_", " ").replace("fully paid", "FULLY PAID").toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="truncate" title={booking.extra_requests || ''}>
                          {booking.extra_requests || '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => handleEditBooking(e, booking)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEmailBookingId(booking.id);
                              setEmailPreviewOpen(true);
                            }}
                            disabled={!booking.customers?.email}
                            title={!booking.customers?.email ? "No email address" : "Send confirmation email"}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBooking(booking);
                            }}
                            disabled={deleteBookingMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AddBookingModal 
        open={showAddBooking} 
        onOpenChange={setShowAddBooking} 
        preSelectedTourId={tourId}
      />

      <AddBookingModal 
        open={showAddWaitlist} 
        onOpenChange={setShowAddWaitlist} 
        preSelectedTourId={tourId}
        defaultStatus="waitlisted"
      />

      <EmailPreviewModal
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        bookingId={emailBookingId}
      />
    </>
  );
};
