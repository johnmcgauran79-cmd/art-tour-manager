
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/hooks/useTasks";

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
        isBlocked: task.depends_on_task_id && dependencyChain.some(dep => dep.status !== 'completed'),
        willUnblock: blockedTasks.length > 0 && task.status !== 'completed'
      };
    },
    enabled: !!taskId,
  });
};

export const useUpdateTaskDependency = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      dependsOnTaskId: string | null;
    }) => {
      // Check for circular dependencies
      if (data.dependsOnTaskId) {
        const { data: potentialCircular } = await supabase
          .from('tasks')
          .select('depends_on_task_id')
          .eq('id', data.dependsOnTaskId)
          .single();

        if (potentialCircular?.depends_on_task_id === data.taskId) {
          throw new Error('Circular dependency detected');
        }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .update({ depends_on_task_id: data.dependsOnTaskId })
        .eq('id', data.taskId)
        .select()
        .single();

      if (error) throw error;
      return task;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      
      toast({
        title: "Dependency Updated",
        description: "Task dependency has been successfully updated.",
      });
    },
    onError: (error) => {
      console.error('Error updating task dependency:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update task dependency.",
        variant: "destructive",
      });
    },
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
