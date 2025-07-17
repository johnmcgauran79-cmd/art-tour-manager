
import { useAuth } from "@/hooks/useAuth";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useHotelsRealtime } from "@/hooks/realtime/useHotelsRealtime";
import { useActivitiesRealtime } from "@/hooks/realtime/useActivitiesRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const userId = user?.id || '';
  
  console.log('useRealtimeNotifications called with userId:', userId);
  
  // Call the real-time hooks directly when we have a userId
  useTasksRealtime(userId);
  useToursRealtime(userId);
  useBookingsRealtime(userId);
  useHotelsRealtime(userId);
  useActivitiesRealtime(userId);
  
  return null;
};
