
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/hooks/useTasks";
import { isTaskFinished } from "@/lib/taskStatuses";

export const useTaskDependencies = (taskId?: string) => {
  return useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: async () => {
      if (!taskId) return null;

      // Get the task and its dependencies
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;

      let dependencyChain: Task[] = [];
      let blockedTasks: Task[] = [];

      // Get dependency chain (tasks this task depends on)
      if (task.depends_on_task_id) {
        const { data: dependencies, error: depError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', task.depends_on_task_id);

        if (depError) throw depError;
        dependencyChain = dependencies || [];
      }

      // Get blocked tasks (tasks that depend on this task)
      const { data: blocked, error: blockedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('depends_on_task_id', taskId);

      if (blockedError) throw blockedError;
      blockedTasks = blocked || [];

      return {
        task,
        dependencyChain,
        blockedTasks,
        isBlocked: task.depends_on_task_id && dependencyChain.some(dep => !isTaskFinished(dep.status)),
        willUnblock: blockedTasks.length > 0 && !isTaskFinished(task.status)
      };
    },
    enabled: !!taskId,
  });
};
export const useAutoUnblockTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (completedTaskId: string) => {
      // Find all tasks that were blocked by this task
      const { data: blockedTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('depends_on_task_id', completedTaskId)
        .eq('status', 'waiting');

      if (error) throw error;

      if (blockedTasks && blockedTasks.length > 0) {
        // Update blocked tasks to not_started if they were waiting
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ status: 'not_started' })
          .eq('depends_on_task_id', completedTaskId)
          .eq('status', 'waiting');

        if (updateError) throw updateError;

        return blockedTasks;
      }

      return [];
    },
    onSuccess: (unblockedTasks) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      
      if (unblockedTasks.length > 0) {
        toast({
          title: "Tasks Unblocked",
          description: `${unblockedTasks.length} task(s) have been automatically unblocked.`,
        });
      }
    },
    onError: (error) => {
      console.error('Error auto-unblocking tasks:', error);
    },
  });
};
