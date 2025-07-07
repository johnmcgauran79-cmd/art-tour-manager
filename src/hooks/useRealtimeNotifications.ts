
import { useAuth } from "@/hooks/useAuth";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useHotelsRealtime } from "@/hooks/realtime/useHotelsRealtime";
import { useActivitiesRealtime } from "@/hooks/realtime/useActivitiesRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const userId = user?.id || '';
  
  console.log('useRealtimeNotifications initialized for user:', userId);
  
  // Initialize all realtime subscriptions only if user exists
  if (userId) {
    useTasksRealtime(userId);
    useToursRealtime(userId);
    useBookingsRealtime(userId);
    useHotelsRealtime(userId);
    useActivitiesRealtime(userId);
  }
  
  return null;
};
