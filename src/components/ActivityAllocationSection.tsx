
import { useState, useEffect } from "react";
import { useActivities } from "@/hooks/useActivities";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Edit } from "lucide-react";

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

  console.log('ActivityAllocationSection rendered with:', {
    tourId,
    bookingId,
    passengerCount,
    activities: activities?.length,
    activityBookings: activityBookings?.length,
    editingActivity,
    allocations
  });

  // Sort activities by date, then by start time, then by creation date
  const sortedActivities = activities ? [...activities].sort((a, b) => {
    // First sort by activity_date
    if (a.activity_date && b.activity_date) {
      const dateComparison = new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      if (a.start_time && b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }
      if (a.start_time && !b.start_time) return -1;
      if (!a.start_time && b.start_time) return 1;
    }
    
    if (a.activity_date && !b.activity_date) return -1;
    if (!a.activity_date && b.activity_date) return 1;
    
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }) : [];

  useEffect(() => {
    console.log('Effect triggered - setting allocations');
    if (sortedActivities && activityBookings !== undefined) {
      const initialAllocations: Record<string, number> = {};
      
      sortedActivities.forEach(activity => {
        const existingBooking = activityBookings.find(ab => ab.activity_id === activity.id);
        const allocation = existingBooking?.passengers_attending || passengerCount;
        initialAllocations[activity.id] = allocation;
        console.log(`Setting allocation for ${activity.name}:`, allocation);
      });
      
      console.log('Final allocations:', initialAllocations);
      setAllocations(initialAllocations);
    }
  }, [sortedActivities, activityBookings, passengerCount]);

  const handleAllocationChange = (activityId: string, value: string) => {
    console.log('handleAllocationChange called:', { activityId, value });
    const numValue = Math.max(0, parseInt(value) || 0);
    console.log('Setting allocation to:', numValue);
    setAllocations(prev => {
      const newAllocations = { ...prev, [activityId]: numValue };
      console.log('New allocations state:', newAllocations);
      return newAllocations;
    });
  };

  const startEditing = (activityId: string) => {
    console.log('startEditing called for:', activityId);
    setEditingActivity(activityId);
    
    // Focus the input after it's rendered
    setTimeout(() => {
      const input = document.getElementById(`activity-input-${activityId}`) as HTMLInputElement;
      console.log('Input element found:', !!input);
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  };

  const handleSaveActivity = async (activityId: string) => {
    console.log('handleSaveActivity called for:', activityId, 'with value:', allocations[activityId]);
    setSavingActivity(activityId);

    try {
      const passengers = allocations[activityId] || 0;
      const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);

      console.log('Existing booking:', existingBooking);
      console.log('Passengers to save:', passengers);

      if (existingBooking) {
        console.log('Updating existing booking');
        await updateActivityBooking.mutateAsync({
          id: existingBooking.id,
          passengers_attending: passengers
        });
      } else if (passengers > 0) {
        console.log('Creating new booking');
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
    console.log('handleCancelEdit called for:', activityId);
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
    const originalValue = existingBooking?.passengers_attending || passengerCount;
    console.log('Resetting to original value:', originalValue);
    setAllocations(prev => ({ ...prev, [activityId]: originalValue }));
    setEditingActivity(null);
  };

  const getOriginalValue = (activityId: string) => {
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
    return existingBooking?.passengers_attending || passengerCount;
  };

  const handleKeyPress = (e: React.KeyboardEvent, activityId: string) => {
    console.log('Key pressed:', e.key);
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveActivity(activityId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit(activityId);
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
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedActivities.map((activity) => {
            const isEditing = editingActivity === activity.id;
            const isSaving = savingActivity === activity.id;
            const currentValue = allocations[activity.id] || 0;
            const originalValue = getOriginalValue(activity.id);
            const hasChanged = currentValue !== originalValue;

            console.log(`Rendering activity ${activity.name}:`, {
              isEditing,
              currentValue,
              originalValue,
              hasChanged
            });

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
                      id={`activity-input-${activity.id}`}
                      type="number"
                      min="0"
                      value={currentValue.toString()}
                      onChange={(e) => {
                        console.log('Input onChange:', e.target.value);
                        handleAllocationChange(activity.id, e.target.value);
                      }}
                      onKeyDown={(e) => handleKeyPress(e, activity.id)}
                      className="w-20"
                      disabled={isSaving}
                      onBlur={() => console.log('Input blur event')}
                      onFocus={() => console.log('Input focus event')}
                    />
                  ) : (
                    <div 
                      className="cursor-pointer hover:bg-muted p-2 rounded w-20 text-center border border-transparent hover:border-muted-foreground/30 select-none"
                      onClick={(e) => {
                        console.log('Div clicked for activity:', activity.id);
                        e.preventDefault();
                        e.stopPropagation();
                        startEditing(activity.id);
                      }}
                      title="Click to edit"
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
                        onClick={(e) => {
                          console.log('Save button clicked');
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveActivity(activity.id);
                        }}
                        disabled={isSaving}
                        className="h-8 w-8 p-0"
                        title="Save changes"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          console.log('Cancel button clicked');
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelEdit(activity.id);
                        }}
                        disabled={isSaving}
                        className="h-8 w-8 p-0"
                        title="Cancel changes"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        console.log('Edit button clicked for:', activity.id);
                        e.preventDefault();
                        e.stopPropagation();
                        startEditing(activity.id);
                      }}
                      className="h-8 w-8 p-0"
                      title="Edit attendance"
                    >
                      <Edit className="h-4 w-4" />
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
