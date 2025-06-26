
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification, getTaskDetails } from "@/utils/notificationHelpers";
import { Department } from "@/hooks/useUserDepartments";

export const useTasksRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (!userId) return;

    console.log('Setting up real-time task subscriptions...');

    const tasksChannel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          console.log('New task created:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          
          const newTask = payload.new as any;
          if (newTask.created_by !== userId) {
            logOperation({
              operation_type: 'CREATE',
              table_name: 'tasks',
              record_id: newTask.id,
              details: {
                task_title: newTask.title,
                created_by_other_user: true,
                is_automated: newTask.is_automated
              }
            });
          }
          
          if ((newTask.priority === 'critical' || newTask.priority === 'high') && newTask.is_automated) {
            const { taskName, tourName } = await getTaskDetails(newTask.id);
            const taskMessage = tourName 
              ? `${taskName} for ${tourName} requires attention.`
              : `${taskName} requires attention.`;

            toast({
              title: "New Priority Task",
              description: taskMessage,
              duration: 5000,
            });

            await createNotification(userId, {
              title: "New Priority Task",
              message: taskMessage,
              type: 'task',
              priority: newTask.priority,
              related_id: newTask.id,
              department: newTask.category as Department,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          console.log('Task updated:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          
          const oldTask = payload.old as any;
          const newTask = payload.new as any;
          
          if (oldTask.status !== newTask.status && newTask.updated_at !== oldTask.updated_at) {
            logOperation({
              operation_type: 'UPDATE',
              table_name: 'tasks',
              record_id: newTask.id,
              details: {
                task_title: newTask.title,
                status_change: `from ${oldTask.status} to ${newTask.status}`,
                updated_by_realtime: true
              }
            });
          }
          
          if (oldTask.status !== newTask.status && newTask.status === 'completed') {
            const { taskName, tourName } = await getTaskDetails(newTask.id);
            const taskMessage = tourName 
              ? `${taskName} for ${tourName} completed.`
              : `${taskName} completed.`;

            toast({
              title: "Task Completed",
              description: taskMessage,
              duration: 3000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          console.log('Task deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });

          const deletedTask = payload.old as any;
          logOperation({
            operation_type: 'DELETE',
            table_name: 'tasks',
            record_id: deletedTask.id,
            details: {
              task_title: deletedTask.title,
              deleted_by_realtime: true
            }
          });

          let tourName = null;
          if (deletedTask.tour_id) {
            try {
              const { data: tour } = await supabase
                .from('tours')
                .select('name')
                .eq('id', deletedTask.tour_id)
                .single();
              tourName = tour?.name || null;
            } catch (error) {
              console.error('Error fetching tour name for deleted task:', error);
            }
          }

          const taskMessage = tourName 
            ? `Task "${deletedTask.title}" for ${tourName} has been deleted.`
            : `Task "${deletedTask.title}" has been deleted.`;

          await createNotification(userId, {
            title: "Task Deleted",
            message: taskMessage,
            type: 'task',
            priority: 'medium',
            related_id: deletedTask.id,
            department: deletedTask.category as Department,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignments'
        },
        async (payload) => {
          console.log('New task assignment:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });

          const assignment = payload.new as any;
          if (assignment.user_id === userId) {
            const { taskName, tourName } = await getTaskDetails(assignment.task_id);
            const assignmentMessage = tourName 
              ? `You have been assigned a new task "${taskName}" for ${tourName}.`
              : `You have been assigned a new task "${taskName}".`;

            await createNotification(userId, {
              title: "Task Assigned",
              message: assignmentMessage,
              type: 'task',
              priority: 'medium',
              related_id: assignment.task_id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments'
        },
        (payload) => {
          console.log('New task comment:', payload.new);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up task real-time subscriptions...');
      supabase.removeChannel(tasksChannel);
    };
  }, [queryClient, toast, userId, logOperation]);
};
