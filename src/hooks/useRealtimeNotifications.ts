
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
  const initializationRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Prevent multiple initializations for the same user
    if (!userId) {
      console.log('useRealtimeNotifications: No userId, skipping initialization');
      return;
    }
    
    if (initializationRef.current === userId) {
      console.log('useRealtimeNotifications: Already initialized for this user, skipping');
      return;
    }
    
    console.log('useRealtimeNotifications initialized for user:', userId);
    initializationRef.current = userId;
    
    return () => {
      console.log('useRealtimeNotifications cleanup for user:', userId);
      initializationRef.current = null;
    };
  }, [userId]);
  
  // Only call hooks when we have a userId and haven't initialized for this user yet
  const shouldInitialize = userId && initializationRef.current === userId;
  
  useTasksRealtime(shouldInitialize ? userId : '');
  useToursRealtime(shouldInitialize ? userId : '');
  useBookingsRealtime(shouldInitialize ? userId : '');
  useHotelsRealtime(shouldInitialize ? userId : '');
  useActivitiesRealtime(shouldInitialize ? userId : '');
  
  return null;
};
