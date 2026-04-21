import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TaskWatcher {
  id: string;
  task_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export const useTaskWatchers = (taskId: string) => {
  return useQuery({
    queryKey: ['task-watchers', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_watchers')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const ids = (data || []).map(w => w.user_id);
      const profileMap: Record<string, any> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', ids);
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
      }
      return (data || []).map(w => ({ ...w, profile: profileMap[w.user_id] || null })) as TaskWatcher[];
    },
    enabled: !!taskId,
  });
};

export const useAddWatcher = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { task_id: string; user_id: string }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('task_watchers')
        .insert({ task_id: input.task_id, user_id: input.user_id, added_by: me.user?.id ?? null });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-watchers', vars.task_id] });
    },
    onError: (e: any) => toast({ title: "Failed to add watcher", description: e.message, variant: "destructive" }),
  });
};

export const useRemoveWatcher = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { task_id: string; user_id: string }) => {
      const { error } = await supabase
        .from('task_watchers')
        .delete()
        .eq('task_id', input.task_id)
        .eq('user_id', input.user_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-watchers', vars.task_id] });
    },
  });
};
