
import { useState, useEffect } from "react";
import { useActivities } from "@/hooks/useActivities";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface ActivityAllocationSectionProps {
  tourId: string;
  bookingId: string;
  passengerCount: number;
}

export const ActivityAllocationSection = ({ 
  tourId, 
  bookingId, 
  passengerCount 
}: ActivityAllocationSectionProps) => {
  const { data: activities } = useActivities(tourId);
  const { 
    data: activityBookings, 
    createActivityBooking, 
    updateActivityBooking 
  } = useActivityBookings(bookingId);
  
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Sort activities by date, then by start time, then by creation date
  const sortedActivities = activities ? [...activities].sort((a, b) => {
    // First sort by activity_date
    if (a.activity_date && b.activity_date) {
      const dateComparison = new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      // If dates are the same, sort by start_time
      if (a.start_time && b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }
      if (a.start_time && !b.start_time) return -1;
      if (!a.start_time && b.start_time) return 1;
    }
    
    // If one has a date and the other doesn't, prioritize the one with a date
    if (a.activity_date && !b.activity_date) return -1;
    if (!a.activity_date && b.activity_date) return 1;
    
    // If neither has a date, sort by creation date
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }) : [];

  useEffect(() => {
    if (sortedActivities && activityBookings) {
      const initialAllocations: Record<string, number> = {};
      
      sortedActivities.forEach(activity => {
        const existingBooking = activityBookings.find(ab => ab.activity_id === activity.id);
        // Default to passenger count if no existing booking, otherwise use existing value
        initialAllocations[activity.id] = existingBooking?.passengers_attending || passengerCount;
      });
      
      setAllocations(initialAllocations);
    }
  }, [sortedActivities, activityBookings, passengerCount]);

  const handleAllocationChange = (activityId: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setAllocations(prev => ({ ...prev, [activityId]: numValue }));
  };

  const handleSaveAllAllocations = async () => {
    if (!sortedActivities) return;

    setIsSaving(true);

    try {
      const promises = sortedActivities.map(async (activity) => {
        const passengers = allocations[activity.id] || 0;
        const existingBooking = activityBookings?.find(ab => ab.activity_id === activity.id);

        if (existingBooking) {
          return updateActivityBooking.mutateAsync({
            id: existingBooking.id,
            passengers_attending: passengers
          });
        } else if (passengers > 0) {
          return createActivityBooking.mutateAsync({
            booking_id: bookingId,
            activity_id: activity.id,
            passengers_attending: passengers
          });
        }
      });

      await Promise.all(promises.filter(Boolean));
      
      toast({
        title: "Success",
        description: "All activity allocations updated successfully.",
      });
    } catch (error) {
      console.error('Activity booking error:', error);
      toast({
        title: "Error",
        description: "Failed to update activity allocations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!sortedActivities || sortedActivities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No activities available for this tour.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Activity Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-32">Pax Attending</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedActivities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell className="font-medium">{activity.name}</TableCell>
              <TableCell>
                {activity.activity_date 
                  ? new Date(activity.activity_date).toLocaleDateString()
                  : 'TBD'
                }
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  value={allocations[activity.id] || passengerCount}
                  onChange={(e) => handleAllocationChange(activity.id, e.target.value)}
                  className="w-20"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <div className="flex justify-end">
        <Button
          onClick={handleSaveAllAllocations}
          disabled={isSaving}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          {isSaving ? "Updating..." : "Update All Activities"}
        </Button>
      </div>
    </div>
  );
};
