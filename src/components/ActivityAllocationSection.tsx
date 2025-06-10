
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
  const [savingActivity, setSavingActivity] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (activities && activityBookings) {
      const initialAllocations: Record<string, number> = {};
      
      activities.forEach(activity => {
        const existingBooking = activityBookings.find(ab => ab.activity_id === activity.id);
        // Default to passenger count if no existing booking, otherwise use existing value
        initialAllocations[activity.id] = existingBooking?.passengers_attending || passengerCount;
      });
      
      setAllocations(initialAllocations);
    }
  }, [activities, activityBookings, passengerCount]);

  const handleAllocationChange = (activityId: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setAllocations(prev => ({ ...prev, [activityId]: numValue }));
  };

  const handleSaveAllocation = async (activityId: string) => {
    const passengers = allocations[activityId] || 0;
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);

    setSavingActivity(activityId);

    try {
      if (existingBooking) {
        await updateActivityBooking.mutateAsync({
          id: existingBooking.id,
          passengers_attending: passengers
        });
      } else if (passengers > 0) {
        await createActivityBooking.mutateAsync({
          booking_id: bookingId,
          activity_id: activityId,
          passengers_attending: passengers
        });
      }
      
      toast({
        title: "Success",
        description: "Activity allocation updated successfully.",
      });
    } catch (error) {
      console.error('Activity booking error:', error);
      toast({
        title: "Error",
        description: "Failed to update activity allocation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingActivity(null);
    }
  };

  if (!activities || activities.length === 0) {
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
            <TableHead className="w-20">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
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
              <TableCell>
                <Button
                  onClick={() => handleSaveAllocation(activity.id)}
                  disabled={savingActivity === activity.id}
                  size="sm"
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {savingActivity === activity.id ? "..." : "Save"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
