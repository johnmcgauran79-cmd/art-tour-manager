
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBookings } from "@/hooks/useBookings";
import { useUpdateCustomer } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";

interface BulkDietaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
}

export const BulkDietaryModal = ({ open, onOpenChange, tourId }: BulkDietaryModalProps) => {
  const [dietaryUpdates, setDietaryUpdates] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { data: allBookings, isLoading } = useBookings();
  const updateCustomer = useUpdateCustomer();
  const { toast } = useToast();

  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tourId);

  useEffect(() => {
    if (open && tourBookings.length > 0) {
      console.log('Dietary modal opened, initializing dietary updates for tour bookings:', tourBookings);
      const initialDietary: Record<string, string> = {};
      tourBookings.forEach(booking => {
        if (booking.customers?.id) {
          initialDietary[booking.customers.id] = booking.customers.dietary_requirements || '';
        }
      });
      setDietaryUpdates(initialDietary);
      console.log('Initial dietary updates set:', initialDietary);
    }
  }, [open, tourId]);

  const handleDietaryChange = (customerId: string, newDietary: string) => {
    console.log('handleDietaryChange called:', { customerId, newDietary });
    console.log('Previous dietaryUpdates:', dietaryUpdates);
    
    setDietaryUpdates(prev => {
      const updated = {
        ...prev,
        [customerId]: newDietary
      };
      console.log('Dietary updates after change:', updated);
      return updated;
    });
  };

  const handleBulkUpdate = async () => {
    console.log('Starting bulk dietary update with current updates:', dietaryUpdates);
    setIsUpdating(true);
    
    try {
      const updates = [];
      
      for (const booking of tourBookings) {
        if (!booking.customers?.id) continue;
        
        const customerId = booking.customers.id;
        const newDietary = dietaryUpdates[customerId];
        const currentDietary = booking.customers.dietary_requirements || '';
        
        console.log(`Checking customer ${customerId}: current="${currentDietary}", new="${newDietary}"`);
        
        if (newDietary !== currentDietary) {
          console.log(`Adding update for customer ${customerId}: "${currentDietary}" -> "${newDietary}"`);
          updates.push({
            customerId,
            updatePromise: updateCustomer.mutateAsync({
              id: customerId,
              dietary_requirements: newDietary
            })
          });
        }
      }

      console.log(`Found ${updates.length} customers to update`);

      if (updates.length > 0) {
        const updatePromises = updates.map(update => update.updatePromise);
        await Promise.all(updatePromises);
        console.log('All dietary updates completed successfully');
        
        toast({
          title: "Success",
          description: `Updated dietary requirements for ${updates.length} customer${updates.length > 1 ? 's' : ''}.`,
        });
        onOpenChange(false);
      } else {
        console.log('No dietary changes detected');
        toast({
          title: "No Changes",
          description: "No dietary requirements were changed.",
        });
      }
    } catch (error) {
      console.error('Error during bulk dietary update:', error);
      toast({
        title: "Error",
        description: "Failed to update dietary requirements. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = tourBookings.some(booking => {
    if (!booking.customers?.id) return false;
    const customerId = booking.customers.id;
    const newDietary = dietaryUpdates[customerId];
    const currentDietary = booking.customers.dietary_requirements || '';
    const hasChange = newDietary !== currentDietary;
    console.log(`Customer ${customerId} has changes:`, hasChange, `("${currentDietary}" -> "${newDietary}")`);
    return hasChange;
  });

  console.log('Render - Has dietary changes:', hasChanges);
  console.log('Current dietaryUpdates state:', dietaryUpdates);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Update Dietary Requirements</DialogTitle>
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
          <DialogTitle>Bulk Update Dietary Requirements ({tourBookings.length} bookings)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {tourBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bookings found for this tour.
            </div>
          ) : (
            <div className="space-y-3">
              {tourBookings.map((booking) => {
                if (!booking.customers?.id) return null;
                
                const customerId = booking.customers.id;
                const currentDietary = dietaryUpdates[customerId] || '';
                console.log(`Rendering customer ${customerId} with dietary:`, currentDietary);
                
                return (
                  <div key={booking.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {booking.customers.first_name} {booking.customers.last_name}
                        {booking.group_name && (
                          <span className="text-sm text-muted-foreground ml-2">
                            (Group: {booking.group_name})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {booking.passenger_count} passenger{booking.passenger_count > 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <div className="flex-1 max-w-md">
                      <Textarea
                        placeholder="Enter dietary requirements..."
                        value={currentDietary}
                        onChange={(e) => handleDietaryChange(customerId, e.target.value)}
                        className="min-h-[80px] resize-none"
                        rows={3}
                      />
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
              if (!b.customers?.id) return false;
              const customerId = b.customers.id;
              const newDietary = dietaryUpdates[customerId];
              const currentDietary = b.customers.dietary_requirements || '';
              return newDietary !== currentDietary;
            }).length})` : ''}`}
          </Button>
        </DialogFooter>
      </Dialog>
    </Dialog>
  );
};
