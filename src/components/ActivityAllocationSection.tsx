
import { useState, useEffect } from "react";
import { useActivities } from "@/hooks/useActivities";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();

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

  // Initialize allocations when data is loaded
  useEffect(() => {
    if (sortedActivities.length > 0 && activityBookings !== undefined) {
      const newAllocations: Record<string, number> = {};
      
      sortedActivities.forEach(activity => {
        const existingBooking = activityBookings.find(ab => ab.activity_id === activity.id);
        // Use existing booking value if it exists, otherwise default to passengerCount
        const allocation = existingBooking?.passengers_attending ?? passengerCount;
        newAllocations[activity.id] = allocation;
      });
      
      setAllocations(newAllocations);
    }
  }, [sortedActivities, activityBookings, passengerCount]);

  const createNotification = async (activityName: string, newCount: number, oldCount: number) => {
    if (!user?.id) return;

    try {
      // Get booking and tour details for context
      const { data: booking } = await supabase
        .from('bookings')
        .select(`
          group_name,
          lead_passenger_id,
          tours(name),
          customers(first_name, last_name)
        `)
        .eq('id', bookingId)
        .single();

      if (booking) {
        const contactName = booking.customers 
          ? `${booking.customers.first_name} ${booking.customers.last_name}`
          : booking.group_name || 'Unknown Contact';
        const tourName = booking.tours?.name || 'Unknown Tour';

        await supabase
          .from('user_notifications')
          .insert({
            user_id: user.id,
            title: "Activity Update",
            message: `${activityName} - attendance updated from ${oldCount} to ${newCount} pax for ${contactName} on "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: bookingId,
          });
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const handleAllocationChange = (activityId: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setAllocations(prev => ({ ...prev, [activityId]: numValue }));
  };

  const startEditing = (activityId: string) => {
    setEditingActivity(activityId);
    
    // Focus the input after it's rendered
    setTimeout(() => {
      const input = document.getElementById(`activity-input-${activityId}`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  };

  const handleSaveActivity = async (activityId: string) => {
    setSavingActivity(activityId);

    try {
      const passengers = allocations[activityId] || 0;
      const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
      const oldCount = existingBooking?.passengers_attending ?? passengerCount;
      
      // Get activity name for notification
      const activity = sortedActivities.find(a => a.id === activityId);
      const activityName = activity?.name || 'Unknown Activity';

      if (existingBooking) {
        // Update existing booking
        await updateActivityBooking.mutateAsync({
          id: existingBooking.id,
          passengers_attending: passengers
        });
      } else {
        // Create new booking (even if passengers is 0, to track the explicit allocation)
        await createActivityBooking.mutateAsync({
          booking_id: bookingId,
          activity_id: activityId,
          passengers_attending: passengers
        });
      }
      
      // Create notification if the count changed
      if (oldCount !== passengers) {
        await createNotification(activityName, passengers, oldCount);
      }
      
      setEditingActivity(null);
      toast({
        title: "Success",
        description: `${activityName} attendance updated successfully.`,
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
    // Reset to the original value from the database
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
    const originalValue = existingBooking?.passengers_attending ?? passengerCount;
    setAllocations(prev => ({ ...prev, [activityId]: originalValue }));
    setEditingActivity(null);
  };

  const getOriginalValue = (activityId: string) => {
    const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
    return existingBooking?.passengers_attending ?? passengerCount;
  };

  const handleKeyPress = (e: React.KeyboardEvent, activityId: string) => {
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
                      onChange={(e) => handleAllocationChange(activity.id, e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, activity.id)}
                      className="w-20"
                      disabled={isSaving}
                    />
                  ) : (
                    <div 
                      className="cursor-pointer hover:bg-muted p-2 rounded w-20 text-center border border-transparent hover:border-muted-foreground/30 select-none"
                      onClick={() => startEditing(activity.id)}
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
                        onClick={() => handleSaveActivity(activity.id)}
                        disabled={isSaving}
                        className="h-8 w-8 p-0"
                        title="Save changes"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelEdit(activity.id)}
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
                      onClick={() => startEditing(activity.id)}
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
