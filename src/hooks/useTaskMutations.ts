import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Task } from "./useTaskQueries";

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (taskId: string) => {
      console.log('Starting task deletion for task ID:', taskId);
      
      // First get task details for logging and notification
      const { data: taskData, error: fetchError } = await supabase
        .from('tasks')
        .select('title, tour_id, created_by, tours(name)')
        .eq('id', taskId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching task details:', fetchError);
        throw new Error(`Failed to fetch task details: ${fetchError.message}`);
      }

      if (!taskData) {
        console.error('Task not found:', taskId);
        throw new Error(`Task not found: ${taskId}`);
      }

      console.log('Task data before deletion:', taskData);

      // Delete task assignments first
      console.log('Deleting task assignments...');
      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', taskId);

      if (assignmentError) {
        console.error('Error deleting task assignments:', assignmentError);
        throw new Error(`Failed to delete task assignments: ${assignmentError.message}`);
      }

      // Delete task comments
      console.log('Deleting task comments...');
      const { error: commentsError } = await supabase
        .from('task_comments')    
        .delete()
        .eq('task_id', taskId);

      if (commentsError) {
        console.error('Error deleting task comments:', commentsError);
        throw new Error(`Failed to delete task comments: ${commentsError.message}`);
      }

      // Delete task attachments
      console.log('Deleting task attachments...');
      const { error: attachmentsError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('task_id', taskId);

      if (attachmentsError) {
        console.error('Error deleting task attachments:', attachmentsError);
        throw new Error(`Failed to delete task attachments: ${attachmentsError.message}`);
      }

      // Finally delete the task itself
      console.log('Deleting the task...');
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (taskError) {
        console.error('Error deleting task:', taskError);
        throw new Error(`Failed to delete task: ${taskError.message}`);
      }

      console.log('Task deletion successful');

      // Log the deletion
      logOperation({
        operation_type: 'DELETE',
        table_name: 'tasks',
        record_id: taskId,
        details: {
          task_title: taskData?.title,
          tour_id: taskData?.tour_id,
          tour_name: taskData?.tours?.name,
          deleted_manually: true
        }
      });

      return { taskId, taskData };
    },
    onSuccess: (data) => {
      console.log('Task deletion mutation successful, updating UI...');
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['my-tasks'] });
      
      queryClient.setQueryData(['tasks'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((task: any) => task.id !== data.taskId);
      });
      
      queryClient.setQueryData(['my-tasks'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((task: any) => task.id !== data.taskId);
      });
      
      console.log('Task UI updates complete');
    },
    onError: (error) => {
      console.error('Task deletion failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      category: 'booking' | 'operations' | 'finance' | 'marketing' | 'maintenance' | 'general';
      due_date?: string;
      tour_id?: string;
      depends_on_task_id?: string;
      url_reference?: string;
      assignee_ids?: string[];
    }) => {
      console.log('useCreateTask mutation called with:', taskData);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('Authenticated user:', user.user.id);

      const taskInsertData = {
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        category: taskData.category,
        due_date: taskData.due_date || null,
        tour_id: taskData.tour_id || null,
        depends_on_task_id: taskData.depends_on_task_id || null,
        url_reference: taskData.url_reference || null,
        created_by: user.user.id,
        status: 'not_started' as const,
        is_automated: false,
      };

      console.log('Inserting task with data:', taskInsertData);

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskInsertData)
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        throw new Error(`Failed to create task: ${taskError.message}`);
      }

      console.log('Task created successfully:', task);

      logOperation({
        operation_type: 'CREATE',
        table_name: 'tasks',
        record_id: task.id,
        details: {
          task_title: task.title,
          priority: task.priority,
          category: task.category,
          tour_id: task.tour_id
        }
      });

      // Add assignments if provided
      if (taskData.assignee_ids && taskData.assignee_ids.length > 0) {
        console.log('Adding assignments for users:', taskData.assignee_ids);
        
        const assignments = taskData.assignee_ids.map(userId => ({
          task_id: task.id,
          user_id: userId,
          assigned_by: user.user.id,
        }));

        console.log('Assignment data:', assignments);

        const { error: assignmentError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignmentError) {
          console.error('Error creating task assignments:', assignmentError);
          throw new Error(`Failed to create task assignments: ${assignmentError.message}`);
        }

        console.log('Task assignments created successfully');

        // Fire-and-forget notification (don't block UI on Teams/email delivery)
        supabase.functions
          .invoke('send-task-notification', {
            body: {
              type: 'assignment',
              taskId: task.id,
              recipientUserIds: taskData.assignee_ids,
              actorUserId: user.user.id,
              message: taskData.description,
            },
          })
          .catch((emailErr) => {
            console.error('Failed to send assignment notification:', emailErr);
          });
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'category' | 'due_date' | 'completed_at' | 'depends_on_task_id' | 'url_reference' | 'quick_update'>> & { tour_id?: string | null };
      silent?: boolean;
    }) => {
      console.log('[useUpdateTask] Starting update for task:', data.taskId, 'with updates:', data.updates);
      
      const { data: user, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[useUpdateTask] Auth error:', authError);
        throw new Error('Authentication failed. Please log in again.');
      }
      
      if (!user.user) {
        console.error('[useUpdateTask] No authenticated user found');
        throw new Error('You must be logged in to update tasks.');
      }

      console.log('[useUpdateTask] Authenticated user:', user.user.id);

      const updateData = { ...data.updates };
      
      // If marking as completed, set completed_at
      if (data.updates.status === 'completed' && !data.updates.completed_at) {
        updateData.completed_at = new Date().toISOString();
        console.log('[useUpdateTask] Setting completed_at to:', updateData.completed_at);
      }
      
      console.log('[useUpdateTask] Final update data:', updateData);
      
      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', data.taskId)
        .select()
        .maybeSingle();

      console.log('[useUpdateTask] Database response:', { updatedTask, updateError });

      if (updateError) {
        console.error('[useUpdateTask] Database update error:', updateError);
        throw new Error(`Failed to update task: ${updateError.message}`);
      }
      
      if (!updatedTask) {
        console.error('[useUpdateTask] No task returned from update');
        throw new Error('Failed to update task - you may not have permission to modify this task');
      }

      console.log('[useUpdateTask] Update successful:', updatedTask);
      return updatedTask;
    },
    onSuccess: (task, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });

      if (!variables.silent) {
        toast({
          title: "Task Updated",
          description: "The task has been successfully updated.",
        });
      }
      
      logOperation({
        operation_type: 'UPDATE',
        table_name: 'tasks',
        record_id: variables.taskId,
        details: {
          updated_fields: Object.keys(variables.updates),
          status_change: variables.updates.status ? `to ${variables.updates.status}` : undefined
        }
      });
    },
    onError: (error) => {
      console.error('[useUpdateTask] Mutation error:', error);
      toast({
        title: "Error",
        description: `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
    retry: 1,
    retryDelay: 500,
  });
};
