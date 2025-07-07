
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useHotelsRealtime } from "@/hooks/realtime/useHotelsRealtime";
import { useActivitiesRealtime } from "@/hooks/realtime/useActivitiesRealtime";

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const userId = user?.id || '';
  const isInitialized = useRef(false);
  
  useEffect(() => {
    // Prevent multiple initializations
    if (!userId || isInitialized.current) {
      return;
    }
    
    console.log('useRealtimeNotifications initialized for user:', userId);
    isInitialized.current = true;
    
    return () => {
      isInitialized.current = false;
    };
  }, [userId]);
  
  // Initialize realtime subscriptions directly (not inside useEffect)
  useTasksRealtime(userId);
  useToursRealtime(userId);
  useBookingsRealtime(userId);
  useHotelsRealtime(userId);
  useActivitiesRealtime(userId);
  
  return null;
};
