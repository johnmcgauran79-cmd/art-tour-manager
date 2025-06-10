
import { useState, useEffect } from "react";
import { useActivities } from "@/hooks/useActivities";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { toast } = useToast();

  useEffect(() => {
    if (activities && activityBookings) {
      const initialAllocations: Record<string, number> = {};
      
      activities.forEach(activity => {
        const existingBooking = activityBookings.find(ab => ab.activity_id === activity.id);
        initialAllocations[activity.id] = existingBooking?.passengers_attending || passengerCount;
      });
      
      setAllocations(initialAllocations);
    }
  }, [activities, activityBookings, passengerCount]);

  const handleAllocationChange = (activityId: string, value: string) => {
    const numValue = Math.max(0, Math.min(passengerCount, parseInt(value) || 0));
    setAllocations(prev => ({ ...prev, [activityId]: numValue }));
  };

  const handleSaveAllocation = async (activityId: string) => {
    const passengers = allocations[activityId] || 0;
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);

    try {
      if (existingBooking) {
        await updateActivityBooking.mutateAsync({
          id: existingBooking.id,
          passengers_attending: passengers
        });
      } else {
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
      toast({
        title: "Error",
        description: "Failed to update activity allocation.",
        variant: "destructive",
      });
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
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Activity Allocations</h3>
        <p className="text-sm text-muted-foreground">
          Allocate passengers to activities (Max: {passengerCount} passengers)
        </p>
      </div>

      {activities.map((activity) => (
        <Card key={activity.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{activity.name}</CardTitle>
            {activity.location && (
              <p className="text-sm text-muted-foreground">{activity.location}</p>
            )}
            {activity.activity_date && (
              <p className="text-sm text-muted-foreground">
                Date: {new Date(activity.activity_date).toLocaleDateString()}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor={`activity-${activity.id}`} className="text-sm">
                  Passengers Attending
                </Label>
                <Input
                  id={`activity-${activity.id}`}
                  type="number"
                  min="0"
                  max={passengerCount}
                  value={allocations[activity.id] || 0}
                  onChange={(e) => handleAllocationChange(activity.id, e.target.value)}
                  className="w-20"
                />
              </div>
              
              <div className="text-sm text-muted-foreground">
                <span>Available: {activity.spots_available || 0}</span><br />
                <span>Booked: {activity.spots_booked || 0}</span>
              </div>
              
              <Button
                onClick={() => handleSaveAllocation(activity.id)}
                disabled={createActivityBooking.isPending || updateActivityBooking.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                {createActivityBooking.isPending || updateActivityBooking.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
