import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskActivityEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  event_type: string;
  old_value: any;
  new_value: any;
  message: string | null;
  created_at: string;
  actor?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export const useTaskActivity = (taskId: string) => {
  return useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('task_activity_log')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Hydrate actor profiles
      const actorIds = Array.from(new Set((events || []).map(e => e.actor_id).filter(Boolean) as string[]));
      const actorMap: Record<string, any> = {};
      if (actorIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', actorIds);
        (profiles || []).forEach(p => { actorMap[p.id] = p; });
      }

      return (events || []).map(e => ({
        ...e,
        actor: e.actor_id ? actorMap[e.actor_id] || null : null,
      })) as TaskActivityEvent[];
    },
    enabled: !!taskId,
  });
};
