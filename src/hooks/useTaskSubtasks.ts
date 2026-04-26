import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
  created_by: string;
  due_date: string | null;
  assignee_id: string | null;
  latest_note: string | null;
  latest_note_at: string | null;
  latest_note_by: string | null;
}

export const useTaskSubtasks = (taskId: string) => {
  return useQuery({
    queryKey: ['task-subtasks', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as TaskSubtask[];
    },
    enabled: !!taskId,
  });
};

export const useCreateSubtask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { task_id: string; title: string; assignee_id?: string | null }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('task_subtasks')
        .insert({
          task_id: input.task_id,
          title: input.title,
          created_by: user.user.id,
          assignee_id: input.assignee_id ?? user.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-subtasks', vars.task_id] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', vars.task_id] });
    },
    onError: (e: any) => toast({ title: "Failed to add subtask", description: e.message, variant: "destructive" }),
  });
};

export const useToggleSubtask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; task_id: string; completed: boolean }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('task_subtasks')
        .update({
          completed: input.completed,
          completed_at: input.completed ? new Date().toISOString() : null,
          completed_by: input.completed ? user.user?.id ?? null : null,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-subtasks', vars.task_id] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', vars.task_id] });
    },
  });
};

export const useDeleteSubtask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; task_id: string }) => {
      const { error } = await supabase.from('task_subtasks').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-subtasks', vars.task_id] });
    },
  });
};

export const useUpdateSubtask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      task_id: string;
      due_date?: string | null;
      assignee_id?: string | null;
      latest_note?: string | null;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const patch: Record<string, any> = {};
      if ('due_date' in input) patch.due_date = input.due_date;
      if ('assignee_id' in input) patch.assignee_id = input.assignee_id;
      if ('latest_note' in input) {
        patch.latest_note = input.latest_note;
        patch.latest_note_at = new Date().toISOString();
        patch.latest_note_by = user.user?.id ?? null;
      }
      const { error } = await supabase
        .from('task_subtasks')
        .update(patch)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-subtasks', vars.task_id] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', vars.task_id] });
    },
    onError: (e: any) => toast({ title: "Failed to update subtask", description: e.message, variant: "destructive" }),
  });
};
