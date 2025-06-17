
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/hooks/useTasks";

export const useBulkUpdateTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      taskIds: string[];
      updates: Partial<Pick<Task, 'status' | 'priority' | 'category'>>;
    }) => {
      const { error } = await supabase
        .from('tasks')
        .update(data.updates)
        .in('id', data.taskIds);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast({
        title: "Tasks Updated",
        description: `${variables.taskIds.length} tasks have been updated successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update tasks. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useBulkAssignTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      taskIds: string[];
      userIds: string[];
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Remove existing assignments for these tasks
      await supabase
        .from('task_assignments')
        .delete()
        .in('task_id', data.taskIds);

      // Add new assignments
      const assignments = data.taskIds.flatMap(taskId =>
        data.userIds.map(userId => ({
          task_id: taskId,
          user_id: userId,
          assigned_by: user.user.id,
        }))
      );

      const { error } = await supabase
        .from('task_assignments')
        .insert(assignments);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast({
        title: "Tasks Assigned",
        description: `${variables.taskIds.length} tasks have been assigned successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: "Failed to assign tasks. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useBulkDeleteTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', taskIds);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast({
        title: "Tasks Deleted",
        description: `${variables.length} tasks have been deleted successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete tasks. Please try again.",
        variant: "destructive",
      });
    },
  });
};
