
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useAuth } from "@/hooks/useAuth";

export const RealtimeTaskNotifications = () => {
  const { user } = useAuth();
  
  console.log('RealtimeTaskNotifications component mounted for user:', user?.id);
  
  // Initialize all realtime subscriptions
  useRealtimeNotifications();
  
  return null; // This component only handles side effects
};
