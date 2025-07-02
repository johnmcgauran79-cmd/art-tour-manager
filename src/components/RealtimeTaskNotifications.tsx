
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

export const RealtimeTaskNotifications = () => {
  useRealtimeNotifications();
  
  return null; // This component only handles side effects
};
