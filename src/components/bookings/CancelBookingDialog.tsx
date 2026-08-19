import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, FileText, MessageSquare, Receipt, Lock } from "lucide-react";
import { useBookingById } from "@/hooks/useTourBookings";
import { useBookingComments } from "@/hooks/useBookingComments";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

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

  const { data: booking } = useBookingById(open ? bookingId : undefined);
  const { data: comments } = useBookingComments(open ? bookingId : "");

  const handleConfirm = () => {
    onConfirm(cancellationReason);
    setCancellationReason("");
  };

  const bookingNotes = (booking as any)?.booking_notes?.trim();
  const invoiceNotes = (booking as any)?.invoice_notes?.trim();
  const hasNotes = !!(bookingNotes || invoiceNotes || (comments && comments.length > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Cancel Booking
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to cancel this booking? This action will:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Mark the booking as cancelled (status: cancelled)</li>
                <li>Clear active passenger count, dates and revenue</li>
                <li>Soft-cancel hotel allocations and zero out activity passengers</li>
              </ul>
              <p className="text-xs text-muted-foreground italic pt-1">
                All hotel notes, bedding, dates and original values are preserved and the booking can be restored later if needed.
              </p>
            </div>

            {hasNotes && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Special Requests &amp; Notes — Please review before cancelling
                </div>

                {bookingNotes && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                      <FileText className="h-3.5 w-3.5" />
                      Booking Notes
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-background/60 rounded p-2 border border-amber-200 dark:border-amber-900">
                      {bookingNotes}
                    </p>
                  </div>
                )}

                {invoiceNotes && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                      <Receipt className="h-3.5 w-3.5" />
                      Invoice Notes
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-background/60 rounded p-2 border border-amber-200 dark:border-amber-900">
                      {invoiceNotes}
                    </p>
                  </div>
                )}

                {comments && comments.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Comments ({comments.length})
                    </div>
                    <div className="space-y-1.5">
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          className="text-sm bg-background/60 rounded p-2 border border-amber-200 dark:border-amber-900"
                        >
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">
                              {c.profiles?.first_name} {c.profiles?.last_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide">
                              {c.comment_type}
                            </span>
                            {c.is_internal && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px]">
                                <Lock className="h-2.5 w-2.5" />
                                Internal
                              </span>
                            )}
                            <span className="ml-auto">
                              {format(new Date(c.created_at), "d MMM yyyy")}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-foreground">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-amber-800 dark:text-amber-300 italic">
                  Make sure Operations is informed of any outstanding requests above.
                </p>
              </div>
            )}

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
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Keep Booking
            </Button>
          </DialogClose>
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
