
import { useEffect } from "react";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";

export const RealtimeTaskNotifications = () => {
  useRealtimeTasks();
  
  return null; // This component only handles side effects
};
