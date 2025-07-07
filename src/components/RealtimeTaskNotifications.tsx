
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

export const RealtimeTaskNotifications = () => {
  // Initialize all realtime subscriptions
  useRealtimeNotifications();
  
  return null; // This component only handles side effects
};
