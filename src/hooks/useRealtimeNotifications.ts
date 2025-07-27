
import { useAuth } from "@/hooks/useAuth";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useHotelsRealtime } from "@/hooks/realtime/useHotelsRealtime";
import { useActivitiesRealtime } from "@/hooks/realtime/useActivitiesRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  
  console.log('🔔 useRealtimeNotifications called with user:', user?.id);
  
  // Initialize realtime subscriptions when user is authenticated
  // Pass the user ID to identify who is creating the notifications
  if (user?.id) {
    console.log('🚀 Initializing realtime subscriptions for user:', user.id);
    useTasksRealtime(user.id);
    useToursRealtime(user.id);
    useBookingsRealtime(user.id);
    useHotelsRealtime(user.id);
    useActivitiesRealtime(user.id);
    console.log('✅ All realtime hooks initialized successfully');
  } else {
    console.log('❌ No authenticated user, skipping realtime subscriptions');
  }
  
  return null;
};
