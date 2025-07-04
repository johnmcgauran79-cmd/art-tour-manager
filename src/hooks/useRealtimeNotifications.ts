
import { useAuth } from "@/hooks/useAuth";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useActivitiesRealtime } from "@/hooks/realtime/useActivitiesRealtime";
import { useCustomersRealtime } from "@/hooks/realtime/useCustomersRealtime";
import { useHotelsActivitiesRealtime } from "@/hooks/realtime/useHotelsActivitiesRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  
  console.log('Initializing realtime notifications for user:', user?.id);
  
  // Initialize all realtime subscriptions with user ID
  const userId = user?.id || '';
  
  useToursRealtime(userId);
  useBookingsRealtime(userId);
  useTasksRealtime(userId);
  useActivitiesRealtime(userId);
  useCustomersRealtime(userId);
  useHotelsActivitiesRealtime(userId);
  
  console.log('All realtime subscriptions initialized for user:', userId);
};
