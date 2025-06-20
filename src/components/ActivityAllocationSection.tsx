
import { useState, useEffect } from "react";
import { useActivities } from "@/hooks/useActivities";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

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
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [savingActivity, setSavingActivity] = useState<string | null>(null);
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

  const handleSaveActivity = async (activityId: string) => {
    setSavingActivity(activityId);

    try {
      const passengers = allocations[activityId] || 0;
      const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);

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
      
      setEditingActivity(null);
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

  const handleCancelEdit = (activityId: string) => {
    // Reset to original value
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
    const originalValue = existingBooking?.passengers_attending || passengerCount;
    setAllocations(prev => ({ ...prev, [activityId]: originalValue }));
    setEditingActivity(null);
  };

  const getOriginalValue = (activityId: string) => {
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
    return existingBooking?.passengers_attending || passengerCount;
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
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedActivities.map((activity) => {
            const isEditing = editingActivity === activity.id;
            const isSaving = savingActivity === activity.id;
            const currentValue = allocations[activity.id] || passengerCount;
            const originalValue = getOriginalValue(activity.id);
            const hasChanged = currentValue !== originalValue;

            return (
              <TableRow key={activity.id}>
                <TableCell className="font-medium">{activity.name}</TableCell>
                <TableCell>
                  {activity.activity_date 
                    ? new Date(activity.activity_date).toLocaleDateString()
                    : 'TBD'
                  }
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      value={currentValue}
                      onChange={(e) => handleAllocationChange(activity.id, e.target.value)}
                      className="w-20"
                      disabled={isSaving}
                    />
                  ) : (
                    <div 
                      className="cursor-pointer hover:bg-muted p-2 rounded w-20 text-center"
                      onClick={() => setEditingActivity(activity.id)}
                    >
                      {currentValue}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveActivity(activity.id)}
                        disabled={isSaving || !hasChanged}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelEdit(activity.id)}
                        disabled={isSaving}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingActivity(activity.id)}
                      className="h-8 px-2 text-xs"
                    >
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
