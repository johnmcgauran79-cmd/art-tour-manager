import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdateBooking } from "@/hooks/useBookings";
import { useToast } from "@/hooks/use-toast";
import { PaymentAlertLevel } from "@/hooks/usePaymentAlerts";

// Extended booking type with joined customer data
interface BookingWithCustomer {
  id: string;
  tour_id: string;
  lead_passenger_id: string | null;
  passenger_count: number;
  passenger_2_name: string | null;
  passenger_3_name: string | null;
  group_name: string | null;
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice';
  customers?: {
    first_name: string;
    last_name: string;
  } | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "fully_paid": return "bg-green-100 text-green-800";
    case "instalment_paid": return "bg-purple-100 text-purple-800";
    case "deposited": return "bg-blue-100 text-blue-800";
    case "invoiced": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "host": return "bg-emerald-100 text-emerald-800";
    case "racing_breaks_invoice": return "bg-blue-900 text-white";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface PaymentStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: BookingWithCustomer[];
  activeLevel: PaymentAlertLevel | null;
}

export const PaymentStatusModal = ({ open, onOpenChange, bookings, activeLevel }: PaymentStatusModalProps) => {
  const [statusUpdates, setStatusUpdates] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  const updateBooking = useUpdateBooking();
  const { toast } = useToast();

  // Filter bookings based on the active alert level
  const filteredBookings = bookings.filter(b => {
    // Always exclude cancelled, waitlisted, host, and fully_paid
    if (b.status === 'cancelled' || b.status === 'waitlisted' || b.status === 'host' || b.status === 'fully_paid') {
      return false;
    }
    
    if (!activeLevel) return false;
    
    switch (activeLevel.level) {
      case 1:
        // Level 1: pending or invoiced (exclude racing_breaks_invoice)
        return b.status === 'pending' || b.status === 'invoiced';
      case 2:
        // Level 2: pending, invoiced, or deposited (exclude racing_breaks_invoice)
        return b.status === 'pending' || b.status === 'invoiced' || b.status === 'deposited';
      case 3:
        // Level 3: All non-fully_paid (includes racing_breaks_invoice)
        return true;
      default:
        return false;
    }
  });

  useEffect(() => {
    if (open && filteredBookings.length > 0) {
      const initialStatuses: Record<string, string> = {};
      filteredBookings.forEach(booking => {
        initialStatuses[booking.id] = booking.status || 'pending';
      });
      setStatusUpdates(initialStatuses);
    }
  }, [open]);

  const handleStatusChange = (bookingId: string, newStatus: string) => {
    setStatusUpdates(prev => ({
      ...prev,
      [bookingId]: newStatus
    }));
  };

  const handleBulkUpdate = async () => {
    setIsUpdating(true);
    
    try {
      const updates = [];
      
      for (const booking of filteredBookings) {
        const newStatus = statusUpdates[booking.id];
        
        if (newStatus && newStatus !== booking.status) {
          updates.push({
            bookingId: booking.id,
            updatePromise: updateBooking.mutateAsync({
              id: booking.id,
              status: newStatus as 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice'
            })
          });
        }
      }

      if (updates.length > 0) {
        const updatePromises = updates.map(update => update.updatePromise);
        await Promise.all(updatePromises);
        
        toast({
          title: "Success",
          description: `Updated ${updates.length} booking${updates.length > 1 ? 's' : ''}.`,
        });
        onOpenChange(false);
      } else {
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

  const hasChanges = filteredBookings.some(booking => {
    const newStatus = statusUpdates[booking.id];
    return newStatus && newStatus !== booking.status;
  });

  const getLevelDescription = () => {
    if (!activeLevel) return "Payment Status";
    switch (activeLevel.level) {
      case 1:
        return "Deposits Due - Bookings awaiting deposit payment";
      case 2:
        return "Instalments Due - Bookings awaiting instalment payment";
      case 3:
        return "Final Payment Due - All bookings not fully paid";
      default:
        return "Payment Status";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{activeLevel?.label || "Payment Status"} ({filteredBookings.length} bookings)</DialogTitle>
              <p className="text-sm text-muted-foreground">{getLevelDescription()}</p>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All bookings are up to date with payments!
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const currentSelectedStatus = statusUpdates[booking.id] || booking.status || 'pending';
                
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
                        {booking.status === 'racing_breaks_invoice' ? 'RB INVOICE' : (booking.status || 'pending').replace("_", " ").replace("fully paid", "FULLY PAID").toUpperCase()}
                      </Badge>
                      
                      <div className="text-sm text-muted-foreground">
                        →
                      </div>
                      
                      <select
                        value={currentSelectedStatus}
                        onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                        className="w-[140px] h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="pending">Pending</option>
                        <option value="invoiced">Invoiced</option>
                        <option value="deposited">Deposited</option>
                        <option value="instalment_paid">Instalment Paid</option>
                        <option value="fully_paid">Fully Paid</option>
                        <option value="host">Host</option>
                        <option value="racing_breaks_invoice">RB Invoice</option>
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
            disabled={isUpdating || !hasChanges || filteredBookings.length === 0}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            {isUpdating ? "Updating..." : `Update All Changes${hasChanges ? ` (${filteredBookings.filter(b => {
              const newStatus = statusUpdates[b.id];
              return newStatus && newStatus !== b.status;
            }).length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
