
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface CancelBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  bookingId: string;
  isLoading?: boolean;
}

export const CancelBookingDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  bookingId,
  isLoading = false 
}: CancelBookingDialogProps) => {
  const [cancellationReason, setCancellationReason] = useState("");

  const handleConfirm = () => {
    onConfirm(cancellationReason);
    setCancellationReason("");
  };

  const handleCancel = () => {
    setCancellationReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Cancel Booking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel this booking? This action will:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Remove all hotel allocations</li>
            <li>Clear check-in and check-out dates</li>
            <li>Set passenger count to zero</li>
            <li>Remove all activity bookings</li>
            <li>Set revenue to zero</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">Reason for cancellation</Label>
            <Textarea
              id="cancellation-reason"
              placeholder="Please provide a reason for cancelling this booking..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Keep Booking
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={isLoading || !cancellationReason.trim()}
          >
            {isLoading ? 'Cancelling...' : 'Cancel Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
