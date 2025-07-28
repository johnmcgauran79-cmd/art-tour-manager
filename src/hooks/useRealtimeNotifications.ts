
import { useAuth } from "@/hooks/useAuth";

// DEPRECATED: This hook has been replaced by useNotificationSystem
// Individual realtime hooks are disabled to prevent conflicts with the unified notification system
export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  
  console.log('⚠️ useRealtimeNotifications called (DEPRECATED) - using unified notification system instead');
  
  // NOTE: Individual realtime hooks are commented out to prevent conflicts
  // The unified useNotificationSystem in App.tsx now handles all notifications
  
  // Keeping this hook for backward compatibility but doing nothing
  // All notification functionality is now handled by useNotificationSystem
  
  return null;
};
