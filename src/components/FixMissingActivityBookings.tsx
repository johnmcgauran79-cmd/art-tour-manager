import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface FixMissingActivityBookingsProps {
  tourId: string;
  onFixComplete?: () => void;
}

export const FixMissingActivityBookings = ({ tourId, onFixComplete }: FixMissingActivityBookingsProps) => {
  const [isFixing, setIsFixing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const handleFixMissingActivityBookings = async () => {
    setIsFixing(true);
    
    try {
      // Find bookings without activity bookings for this tour
      const { data: bookingsWithoutActivities, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          passenger_count,
          status,
          lead_passenger_id,
          customers!inner(first_name, last_name)
        `)
        .eq('tour_id', tourId)
        .neq('status', 'cancelled');
      
      if (bookingsError) throw bookingsError;
      
      // Get all activities for this tour
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('id')
        .eq('tour_id', tourId);
        
      if (activitiesError) throw activitiesError;
      
      if (!bookingsWithoutActivities || !activities) {
        toast({
          title: "No data found",
          description: "No bookings or activities found for this tour.",
          variant: "destructive",
        });
        return;
      }
      
      let fixedCount = 0;
      
      for (const booking of bookingsWithoutActivities) {
        // Check if this booking already has activity bookings
        const { data: existingActivityBookings } = await supabase
          .from('activity_bookings')
          .select('id')
          .eq('booking_id', booking.id);
          
        // If no activity bookings exist, create them
        if (!existingActivityBookings || existingActivityBookings.length === 0) {
          console.log(`Creating activity bookings for ${booking.customers.first_name} ${booking.customers.last_name}`);
          
          for (const activity of activities) {
            await supabase
              .from('activity_bookings')
              .insert({
                booking_id: booking.id,
                activity_id: activity.id,
                passengers_attending: booking.passenger_count,
              });
          }
          
          fixedCount++;
        }
      }
      
      if (fixedCount > 0) {
        toast({
          title: "Success!",
          description: `Fixed activity bookings for ${fixedCount} booking${fixedCount > 1 ? 's' : ''}`,
        });
        setIsComplete(true);
        onFixComplete?.();
      } else {
        toast({
          title: "All Good!",
          description: "All bookings already have proper activity allocations",
        });
        setIsComplete(true);
      }
      
    } catch (error) {
      console.error('Error fixing activity bookings:', error);
      toast({
        title: "Error",
        description: "Failed to fix activity bookings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
    }
  };

  if (isComplete) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm">Activity bookings fixed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <AlertTriangle className="h-5 w-5 text-yellow-600" />
      <div className="flex-1">
        <div className="text-sm font-medium text-yellow-800">
          Missing Activity Bookings Detected
        </div>
        <div className="text-xs text-yellow-600">
          Some bookings may not have activity allocations
        </div>
      </div>
      <Button
        onClick={handleFixMissingActivityBookings}
        disabled={isFixing}
        size="sm"
        variant="outline"
      >
        {isFixing ? 'Fixing...' : 'Fix Now'}
      </Button>
    </div>
  );
};