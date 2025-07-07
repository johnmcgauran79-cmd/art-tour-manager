
import { useEffect, useRef } from "react";
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
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      console.log('Tasks realtime already subscribed, skipping...');
      return;
    }

    console.log('Setting up real-time task subscriptions...');

    const channelName = `tasks-realtime-${userId}-${Date.now()}`;
    const tasksChannel = supabase
      .channel(channelName)
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
          const { taskName, tourName } = await getTaskDetails(newTask.id);

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
          
          // Single task notification to the relevant department
          const taskMessage = tourName 
            ? `New task "${taskName}" created for ${tourName}.`
            : `New task "${taskName}" created.`;

          await createNotification('', {
            title: "New Task Created",
            message: taskMessage,
            type: 'task',
            priority: newTask.priority,
            related_id: newTask.id,
            department: newTask.category as Department,
          });

          // Only for critical/high priority tasks, also notify operations (if not already operations category)
          if ((newTask.priority === 'critical' || newTask.priority === 'high') && 
              newTask.category !== 'operations') {
            const priorityMessage = tourName 
              ? `${taskName} for ${tourName} requires attention.`
              : `${taskName} requires attention.`;

            await createNotification('', {
              title: "New Priority Task",
              message: priorityMessage,
              type: 'task',
              priority: newTask.priority,
              related_id: newTask.id,
              department: 'operations',
            });

            toast({
              title: "New Priority Task",
              description: priorityMessage,
              duration: 5000,
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
          
          // Only notify on status changes, not other updates
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

            // Only notify on task completion
            if (newTask.status === 'completed') {
              const { taskName, tourName } = await getTaskDetails(newTask.id);
              const taskMessage = tourName 
                ? `Task "${taskName}" for ${tourName} has been completed.`
                : `Task "${taskName}" has been completed.`;

              await createNotification('', {
                title: "Task Completed",
                message: taskMessage,
                type: 'task',
                priority: 'medium',
                related_id: newTask.id,
                department: newTask.category as Department,
              });

              toast({
                title: "Task Completed",
                description: taskMessage,
                duration: 3000,
              });
            }
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

          await createNotification('', {
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
          // Only notify the specific user being assigned
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

    channelRef.current = tasksChannel;

    return () => {
      console.log('Cleaning up task real-time subscriptions...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, toast, userId, logOperation]);
};
