
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
  const processedEvents = useRef<Set<string>>(new Set());

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
          
          // Skip notifications for tasks created by the current user (they already know they created it)
          if (newTask.created_by === userId) {
            console.log('Skipping notification for self-created task');
            return;
          }

          const { taskName, tourName } = await getTaskDetails(newTask.id);

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
          
          // Create ONE notification - prioritize operations for critical/high priority, otherwise department
          const shouldNotifyOperations = (newTask.priority === 'critical' || newTask.priority === 'high') && 
                                        newTask.category !== 'operations';
          
          const targetDepartment = shouldNotifyOperations ? 'operations' : (newTask.category as Department);
          const notificationTitle = shouldNotifyOperations ? "New Priority Task" : "New Task Created";
          
          const taskMessage = tourName 
            ? `${shouldNotifyOperations ? 'Priority task' : 'New task'} "${taskName}" ${shouldNotifyOperations ? 'requires attention' : 'created'} for ${tourName}.`
            : `${shouldNotifyOperations ? 'Priority task' : 'New task'} "${taskName}" ${shouldNotifyOperations ? 'requires attention' : 'created'}.`;

          await createNotification('', {
            title: notificationTitle,
            message: taskMessage,
            type: 'task',
            priority: newTask.priority,
            related_id: newTask.id,
            department: targetDepartment,
          });

          // Show toast only for high priority tasks
          if (shouldNotifyOperations) {
            toast({
              title: notificationTitle,
              description: taskMessage,
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
          
          // Only notify on significant status changes (not minor field updates)
          const isStatusChange = oldTask.status !== newTask.status;
          const isSignificantStatusChange = isStatusChange && (
            newTask.status === 'completed' || 
            newTask.status === 'cancelled' || 
            (oldTask.status === 'not_started' && newTask.status === 'in_progress')
          );
          
          if (!isSignificantStatusChange) {
            console.log('Skipping notification for non-significant task update');
            return;
          }

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

          // Only notify on task completion or significant status changes
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
          } else if (oldTask.status === 'not_started' && newTask.status === 'in_progress') {
            const { taskName, tourName } = await getTaskDetails(newTask.id);
            const taskMessage = tourName 
              ? `Task "${taskName}" for ${tourName} has been started.`
              : `Task "${taskName}" has been started.`;

            await createNotification('', {
              title: "Task Started",
              message: taskMessage,
              type: 'task',
              priority: 'low',
              related_id: newTask.id,
              department: newTask.category as Department,
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
          console.log('Task deleted via realtime:', payload.old);
          
          const deletedTask = payload.old as any;
          const taskId = deletedTask.id;
          const eventKey = `delete-${taskId}-${Date.now()}`;

          // Prevent duplicate processing of the same deletion with a more robust key
          if (processedEvents.current.has(taskId)) {
            console.log('Deletion already processed for task:', taskId);
            return;
          }
          processedEvents.current.add(taskId);

          // Clean up processed events after 30 seconds to prevent memory leaks
          setTimeout(() => {
            processedEvents.current.delete(taskId);
          }, 30000);

          // Force refresh of task queries to immediately update UI
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          queryClient.refetchQueries({ queryKey: ['tasks'] });
          queryClient.refetchQueries({ queryKey: ['my-tasks'] });

          // Don't create notifications for tasks deleted by the current user
          if (deletedTask.created_by === userId) {
            console.log('Skipping deletion notification for self-deleted task');
            return;
          }

          logOperation({
            operation_type: 'DELETE',
            table_name: 'tasks',
            record_id: deletedTask.id,
            details: {
              task_title: deletedTask.title,
              deleted_by_realtime: true
            }
          });

          // Use the task data from the payload directly since the task is already deleted
          const taskName = deletedTask.title || 'Untitled Task';
          let tourName = null;

          // Get tour name if tour_id exists
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
            ? `Task "${taskName}" for ${tourName} has been deleted.`
            : `Task "${taskName}" has been deleted.`;

          // Create notification for task deletion (only if not deleted by current user)
          await createNotification('', {
            title: "Task Deleted",
            message: taskMessage,
            type: 'task',
            priority: 'medium',
            related_id: deletedTask.id,
            department: deletedTask.category as Department,
          });

          // Show toast notification for task deletion
          toast({
            title: "Task Deleted",
            description: taskMessage,
            duration: 3000,
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
          
          // Only notify the specific user being assigned (not everyone)
          if (assignment.user_id === userId) {
            const { taskName, tourName } = await getTaskDetails(assignment.task_id);
            const assignmentMessage = tourName 
              ? `You have been assigned to task "${taskName}" for ${tourName}.`
              : `You have been assigned to task "${taskName}".`;

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
          // Only invalidate queries for comments, no notifications needed
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
      // Clear processed events on cleanup
      processedEvents.current.clear();
    };
  }, [queryClient, toast, userId, logOperation]);
};
