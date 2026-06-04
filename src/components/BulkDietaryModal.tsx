
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

  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tourId && booking.status !== 'cancelled' && booking.status !== 'waitlisted');

  // Flatten to a deduplicated list of all passengers (lead, pax 2, pax 3) across bookings
  const passengers = (() => {
    const seen = new Map<string, { id: string; name: string; dietary: string }>();
    for (const booking of tourBookings) {
      for (const customer of [booking.customers, (booking as any).passenger_2, (booking as any).passenger_3]) {
        if (customer?.id && !seen.has(customer.id)) {
          seen.set(customer.id, {
            id: customer.id,
            name: `${customer.first_name} ${customer.last_name}`,
            dietary: customer.dietary_requirements || '',
          });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  useEffect(() => {
    if (open && passengers.length > 0) {
      const initialDietary: Record<string, string> = {};
      passengers.forEach(p => {
        initialDietary[p.id] = p.dietary;
      });
      setDietaryUpdates(initialDietary);
    }
  }, [open, tourId]);

  const handleDietaryChange = (customerId: string, newDietary: string) => {
    setDietaryUpdates(prev => ({ ...prev, [customerId]: newDietary }));
  };

  const handleBulkUpdate = async () => {
    setIsUpdating(true);
    
    try {
      const changed = passengers.filter(p => (dietaryUpdates[p.id] ?? p.dietary) !== p.dietary);

      if (changed.length > 0) {
        await Promise.all(changed.map(p =>
          updateCustomer.mutateAsync({ id: p.id, dietary_requirements: dietaryUpdates[p.id] })
        ));

        toast({
          title: "Success",
          description: `Updated dietary requirements for ${changed.length} contact${changed.length > 1 ? 's' : ''}.`,
        });
        onOpenChange(false);
      } else {
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

  const changedCount = passengers.filter(p => (dietaryUpdates[p.id] ?? p.dietary) !== p.dietary).length;
  const hasChanges = changedCount > 0;

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
          <DialogTitle>Bulk Update Dietary Requirements ({passengers.length} contacts)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {passengers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No contacts found for this tour.
            </div>
          ) : (
            <div className="space-y-3">
              {passengers.map((p) => {
                const currentDietary = dietaryUpdates[p.id] ?? '';
                return (
                  <div key={p.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{p.name}</div>
                    </div>
                    <div className="flex-1 max-w-md">
                      <Textarea
                        placeholder="Enter dietary requirements..."
                        value={currentDietary}
                        onChange={(e) => handleDietaryChange(p.id, e.target.value)}
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
            disabled={isUpdating || !hasChanges || passengers.length === 0}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            {isUpdating ? "Updating..." : `Update All Changes${hasChanges ? ` (${changedCount})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
