
import { useAuth } from "@/hooks/useAuth";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useHotelsRealtime } from "@/hooks/realtime/useHotelsRealtime";
import { useActivitiesRealtime } from "@/hooks/realtime/useActivitiesRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  
  console.log('useRealtimeNotifications initialized for user:', user?.id);
  
  // Initialize all realtime subscriptions
  useTasksRealtime(user?.id || '');
  useToursRealtime(user?.id || '');
  useBookingsRealtime(user?.id || '');
  useHotelsRealtime(user?.id || '');
  useActivitiesRealtime(user?.id || '');
  
  return null;
};
