import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Booking {
  id: string;
  lead_passenger_id: string;
  passenger_count: number;
  accommodation_required: boolean;
  customers: {
    first_name: string;
    last_name: string;
  };
}

interface ActivityPassengerAllocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  activityId: string;
  activityName: string;
}

export const ActivityPassengerAllocationModal = ({
  open,
  onOpenChange,
  tourId,
  activityId,
  activityName,
}: ActivityPassengerAllocationModalProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && tourId) {
      fetchBookings();
    }
  }, [open, tourId]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          lead_passenger_id,
          passenger_count,
          accommodation_required,
          customers!bookings_lead_passenger_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq('tour_id', tourId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setBookings(data as Booking[]);

      // Pre-fill allocations: full passenger_count for bookings with accommodation, 0 for others
      const initialAllocations: Record<string, number> = {};
      data?.forEach(booking => {
        initialAllocations[booking.id] = booking.accommodation_required 
          ? booking.passenger_count 
          : 0;
      });
      setAllocations(initialAllocations);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAllocationChange = (bookingId: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setAllocations(prev => ({ ...prev, [bookingId]: numValue }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Create activity_bookings for all allocations > 0
      const activityBookings = Object.entries(allocations)
        .filter(([_, passengers]) => passengers > 0)
        .map(([bookingId, passengers]) => ({
          booking_id: bookingId,
          activity_id: activityId,
          passengers_attending: passengers,
        }));

      if (activityBookings.length > 0) {
        const { error } = await supabase
          .from('activity_bookings')
          .insert(activityBookings);

        if (error) throw error;
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-bookings'] });

      toast({
        title: "Success",
        description: `Passengers allocated to ${activityName}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving activity allocations:', error);
      toast({
        title: "Error",
        description: "Failed to save allocations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Passengers to {activityName}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Review and adjust passenger counts before adding bookings to this activity.
            Bookings with accommodation are pre-filled with their full passenger count.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Loading bookings...</p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Passenger</TableHead>
                    <TableHead className="text-center">Total Pax</TableHead>
                    <TableHead className="text-center">Accommodation</TableHead>
                    <TableHead className="text-center">Attending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        {booking.customers.first_name} {booking.customers.last_name}
                      </TableCell>
                      <TableCell className="text-center">
                        {booking.passenger_count}
                      </TableCell>
                      <TableCell className="text-center">
                        {booking.accommodation_required ? '✓' : '✗'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          max={booking.passenger_count}
                          value={allocations[booking.id] || 0}
                          onChange={(e) => handleAllocationChange(booking.id, e.target.value)}
                          className="w-20 mx-auto text-center"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-4">
              <div className="text-sm text-muted-foreground">
                Total passengers allocated: <span className="font-semibold">{totalAllocated}</span>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            {saving ? "Saving..." : "Confirm Allocations"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
