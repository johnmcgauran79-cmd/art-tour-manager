
import { useAuth } from "@/hooks/useAuth";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  
  // Initialize all realtime subscriptions
  useToursRealtime(user?.id || '');
  useBookingsRealtime(user?.id || '');
  useTasksRealtime(user?.id || '');
};
