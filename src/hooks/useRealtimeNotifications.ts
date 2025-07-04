
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
  
  // Only initialize if we have a user ID and only once per user session
  const userId = user?.id;
  
  if (!userId) {
    console.log('No user ID available for realtime notifications');
    return;
  }
  
  // Initialize all realtime subscriptions with unique user-based identifiers
  useToursRealtime(userId);
  useBookingsRealtime(userId);
  useTasksRealtime(userId);
  useActivitiesRealtime(userId);
  useCustomersRealtime(userId);
  useHotelsActivitiesRealtime(userId);
  
  console.log('All realtime subscriptions initialized for user:', userId);
};
