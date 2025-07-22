
import { useAuth } from "@/hooks/useAuth";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useHotelsRealtime } from "@/hooks/realtime/useHotelsRealtime";
import { useActivitiesRealtime } from "@/hooks/realtime/useActivitiesRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  
  console.log('useRealtimeNotifications called with user:', user?.id);
  
  // Only initialize real-time hooks when we have an authenticated user
  if (user?.id) {
    console.log('Initializing realtime subscriptions for user:', user.id);
    useTasksRealtime(user.id);
    useToursRealtime(user.id);
    useBookingsRealtime(user.id);
    useHotelsRealtime(user.id);
    useActivitiesRealtime(user.id);
  } else {
    console.log('No authenticated user, skipping realtime subscriptions');
  }
  
  return null;
};
