
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
  const [initializedActivities, setInitializedActivities] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize allocations when data is loaded
  useEffect(() => {
    if (activities.length > 0 && activityBookings !== undefined) {
      const newAllocations: Record<string, number> = {};
      const toInitialize: string[] = [];
      
      activities.forEach(activity => {
        const existingBooking = activityBookings.find(ab => ab.activity_id === activity.id);
        if (existingBooking) {
          newAllocations[activity.id] = existingBooking.passengers_attending;
        } else {
          // Default to passenger count for activities without bookings
          newAllocations[activity.id] = passengerCount;
          // Track which activities need initialization
          if (!initializedActivities.has(activity.id)) {
            toInitialize.push(activity.id);
          }
        }
      });
      
      setAllocations(newAllocations);
      
      // Initialize missing activity bookings
      if (toInitialize.length > 0) {
        initializeActivityBookings(toInitialize);
      }
    }
  }, [activities, activityBookings, passengerCount, initializedActivities]);

  const initializeActivityBookings = async (activityIds: string[]) => {
    // Check booking status first - only initialize for non-pending bookings
    const { data: booking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single();
    
    if (!booking || booking.status === 'pending' || booking.status === 'cancelled') {
      return;
    }

    for (const activityId of activityIds) {
      try {
        await createActivityBooking.mutateAsync({
          booking_id: bookingId,
          activity_id: activityId,
          passengers_attending: passengerCount
        });
        
        setInitializedActivities(prev => new Set([...prev, activityId]));
      } catch (error) {
        console.error('Error initializing activity booking:', error);
      }
    }
  };

  const createNotification = async (activityName: string, newCount: number, oldCount: number) => {
    if (!user?.id) return;

    try {
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
      const passengers = Math.max(0, parseInt(tempEditValue) || 0);
      const existingBooking = activityBookings?.find(ab => ab.activity_id === activityId);
      const oldCount = existingBooking?.passengers_attending ?? passengerCount;
      
      const activity = activities.find(a => a.id === activityId);
      const activityName = activity?.name || 'Unknown Activity';

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
      
      if (oldCount !== passengers) {
        await createNotification(activityName, passengers, oldCount);
      }
      
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
