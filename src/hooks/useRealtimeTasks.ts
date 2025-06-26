
import { useAuth } from "@/hooks/useAuth";
import { useTasksRealtime } from "@/hooks/realtime/useTasksRealtime";
import { useToursRealtime } from "@/hooks/realtime/useToursRealtime";
import { useBookingsRealtime } from "@/hooks/realtime/useBookingsRealtime";
import { useHotelsActivitiesRealtime } from "@/hooks/realtime/useHotelsActivitiesRealtime";
import { useCustomersRealtime } from "@/hooks/realtime/useCustomersRealtime";

export const useRealtimeTasks = () => {
  const { user } = useAuth();
  const userId = user?.id || '';

  // Use individual realtime hooks
  useTasksRealtime(userId);
  useToursRealtime(userId);
  useBookingsRealtime(userId);
  useHotelsActivitiesRealtime(userId);
  useCustomersRealtime(userId);
};
