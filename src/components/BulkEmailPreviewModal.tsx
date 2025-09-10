import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useBulkBookingEmail } from "@/hooks/useBulkBookingEmail";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BulkEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
}

export const BulkEmailPreviewModal = ({ open, onOpenChange, tourId }: BulkEmailPreviewModalProps) => {
  const bulkEmailMutation = useBulkBookingEmail();

  // Get count of bookings with emails for this tour
  const { data: emailCount, isLoading } = useQuery({
    queryKey: ['tour-email-count', tourId],
    queryFn: async () => {
      if (!tourId) return 0;
      
      const { count, error } = await supabase
        .from('bookings')
        .select('id', { count: 'exact' })
        .eq('tour_id', tourId)
        .not('customers.email', 'is', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!tourId && open,
  });

  const handleSendEmails = async () => {
    if (!tourId) return;
    
    try {
      await bulkEmailMutation.mutateAsync(tourId);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (!tourId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Bulk Confirmation Emails</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Checking bookings...</span>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">
                {emailCount} booking{emailCount !== 1 ? 's' : ''} with email addresses found
              </p>
              <p className="text-sm text-gray-600">
                Confirmation emails will be sent to all passengers with valid email addresses for this tour.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmails}
              disabled={bulkEmailMutation.isPending || isLoading || !emailCount}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {bulkEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                `Send ${emailCount} Email${emailCount !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};