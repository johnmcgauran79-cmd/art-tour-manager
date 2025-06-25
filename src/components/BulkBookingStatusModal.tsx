
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBookings, useUpdateBooking } from "@/hooks/useBookings";
import { useToast } from "@/hooks/use-toast";

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

interface BulkBookingStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
}

export const BulkBookingStatusModal = ({ open, onOpenChange, tourId }: BulkBookingStatusModalProps) => {
  const [statusUpdates, setStatusUpdates] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { data: allBookings, isLoading } = useBookings();
  const updateBooking = useUpdateBooking();
  const { toast } = useToast();

  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tourId);

  useEffect(() => {
    if (open && tourBookings.length > 0) {
      console.log('Modal opened, initializing status updates for tour bookings:', tourBookings);
      const initialStatuses: Record<string, string> = {};
      tourBookings.forEach(booking => {
        initialStatuses[booking.id] = booking.status || 'pending';
      });
      setStatusUpdates(initialStatuses);
      console.log('Initial status updates set:', initialStatuses);
    }
  }, [open, tourId]); // Only depend on open and tourId, not tourBookings

  const handleStatusChange = (bookingId: string, newStatus: string) => {
    console.log('handleStatusChange called:', { bookingId, newStatus });
    console.log('Previous statusUpdates:', statusUpdates);
    
    setStatusUpdates(prev => {
      const updated = {
        ...prev,
        [bookingId]: newStatus
      };
      console.log('Status updates after change:', updated);
      return updated;
    });
  };

  const handleBulkUpdate = async () => {
    console.log('Starting bulk update with current status updates:', statusUpdates);
    setIsUpdating(true);
    
    try {
      const updates = [];
      
      for (const booking of tourBookings) {
        const newStatus = statusUpdates[booking.id];
        console.log(`Checking booking ${booking.id}: current=${booking.status}, new=${newStatus}`);
        
        if (newStatus && newStatus !== booking.status) {
          console.log(`Adding update for booking ${booking.id}: ${booking.status} -> ${newStatus}`);
          updates.push({
            bookingId: booking.id,
            updatePromise: updateBooking.mutateAsync({
              id: booking.id,
              status: newStatus as 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled'
            })
          });
        }
      }

      console.log(`Found ${updates.length} bookings to update`);

      if (updates.length > 0) {
        const updatePromises = updates.map(update => update.updatePromise);
        await Promise.all(updatePromises);
        console.log('All updates completed successfully');
        
        toast({
          title: "Success",
          description: `Updated ${updates.length} booking${updates.length > 1 ? 's' : ''}.`,
        });
        onOpenChange(false);
      } else {
        console.log('No changes detected');
        toast({
          title: "No Changes",
          description: "No booking statuses were changed.",
        });
      }
    } catch (error) {
      console.error('Error during bulk update:', error);
      toast({
        title: "Error",
        description: "Failed to update booking statuses. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = tourBookings.some(booking => {
    const newStatus = statusUpdates[booking.id];
    const hasChange = newStatus && newStatus !== booking.status;
    console.log(`Booking ${booking.id} has changes:`, hasChange, `(${booking.status} -> ${newStatus})`);
    return hasChange;
  });

  console.log('Render - Has changes:', hasChanges);
  console.log('Current statusUpdates state:', statusUpdates);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Update Booking Status</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">Loading bookings...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Update Booking Status ({tourBookings.length} bookings)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {tourBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bookings found for this tour.
            </div>
          ) : (
            <div className="space-y-3">
              {tourBookings.map((booking) => {
                const currentSelectedStatus = statusUpdates[booking.id] || booking.status || 'pending';
                console.log(`Rendering booking ${booking.id} with status:`, currentSelectedStatus);
                
                return (
                  <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {booking.customers?.first_name} {booking.customers?.last_name}
                        {booking.group_name && (
                          <span className="text-sm text-muted-foreground ml-2">
                            (Group: {booking.group_name})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {booking.passenger_count} passenger{booking.passenger_count > 1 ? 's' : ''}
                        {booking.passenger_2_name && ` • ${booking.passenger_2_name}`}
                        {booking.passenger_3_name && ` • ${booking.passenger_3_name}`}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground">
                        Current:
                      </div>
                      <Badge className={getStatusColor(booking.status || 'pending')}>
                        {(booking.status || 'pending').replace("_", " ").replace("fully paid", "FULLY PAID").toUpperCase()}
                      </Badge>
                      
                      <div className="text-sm text-muted-foreground">
                        →
                      </div>
                      
                      <select
                        value={currentSelectedStatus}
                        onChange={(e) => {
                          console.log('Native select onChange triggered:', { bookingId: booking.id, value: e.target.value, currentValue: currentSelectedStatus });
                          handleStatusChange(booking.id, e.target.value);
                        }}
                        className="w-[140px] h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="pending">Pending</option>
                        <option value="invoiced">Invoiced</option>
                        <option value="deposited">Deposited</option>
                        <option value="instalment_paid">Instalment Paid</option>
                        <option value="fully_paid">Fully Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={isUpdating || !hasChanges || tourBookings.length === 0}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            {isUpdating ? "Updating..." : `Update All Changes${hasChanges ? ` (${tourBookings.filter(b => {
              const newStatus = statusUpdates[b.id];
              return newStatus && newStatus !== b.status;
            }).length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
