import { useState, useEffect } from "react";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UseActivityAllocationProps {
  bookingId: string;
  passengerCount: number;
  activities: any[];
}

export const useActivityAllocation = ({ 
  bookingId, 
  passengerCount, 
  activities 
}: UseActivityAllocationProps) => {
  const { 
    data: activityBookings, 
    createActivityBooking, 
    updateActivityBooking 
  } = useActivityBookings(bookingId);
  
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [savingActivity, setSavingActivity] = useState<string | null>(null);
  const [tempEditValue, setTempEditValue] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize allocations when data is loaded
  useEffect(() => {
    console.log('ActivityAllocation effect - Activities:', activities.length, 'Activity Bookings:', activityBookings);
    
    if (activities.length > 0 && activityBookings !== undefined && !hasInitialized) {
      const newAllocations: Record<string, number> = {};
      
      activities.forEach(activity => {
        const existingBooking = activityBookings.find(ab => ab.activity_id === activity.id);
        console.log(`Activity ${activity.name} (${activity.id}):`, existingBooking ? `Has booking with ${existingBooking.passengers_attending} pax` : 'No booking found');
        
        if (existingBooking) {
          newAllocations[activity.id] = existingBooking.passengers_attending;
        } else {
          // No booking exists - set to 0 (user must manually allocate)
          newAllocations[activity.id] = 0;
        }
      });
      
      console.log('New allocations:', newAllocations);
      setAllocations(newAllocations);
      setHasInitialized(true);
    }
  }, [activities, activityBookings, hasInitialized]);

  // Manual notification creation removed - handled by centralized notification system

  const startEditing = (activityId: string) => {
    const currentValue = allocations[activityId] ?? 0;
    setTempEditValue(currentValue.toString());
    setEditingActivity(activityId);
  };

  const handleAllocationChange = (value: string) => {
    setTempEditValue(value);
  };

  const handleSaveActivity = async (activityId: string) => {
    setSavingActivity(activityId);

    try {
      const passengers = Math.max(0, Number(tempEditValue) || 0);
      const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
      const oldCount = existingBooking?.passengers_attending ?? passengerCount;
      
      const activity = activities.find(a => a.id === activityId);
      const activityName = activity?.name || 'Unknown Activity';

      console.log(`Saving activity ${activityName}: ${passengers} passengers (was ${oldCount})`);

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
      
      setAllocations(prev => ({ ...prev, [activityId]: passengers }));
      
      // Notification will be created automatically by the centralized notification system
      
      setEditingActivity(null);
      setTempEditValue('');
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

  const handleCancelEdit = () => {
    setEditingActivity(null);
    setTempEditValue('');
  };

  return {
    allocations,
    editingActivity,
    savingActivity,
    tempEditValue,
    startEditing,
    handleAllocationChange,
    handleSaveActivity,
    handleCancelEdit,
  };
};
