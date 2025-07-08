
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification, createMultipleNotifications, getTaskDetails } from "@/utils/notificationHelpers";
import { Department } from "@/hooks/useUserDepartments";

export const useTasksRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();
  const channelRef = useRef<any>(null);
  const processedEvents = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    // Early return if no userId or already initialized for this user
    if (!userId || isInitializedRef.current === userId) {
      console.log('Tasks realtime: skipping subscription', { userId, initialized: isInitializedRef.current });
      return;
    }

    console.log('Setting up real-time task subscriptions for user:', userId);
    isInitializedRef.current = userId;

    const subscriptionKey = `tasks-realtime-${userId}-${Date.now()}`;
    const tasksChannel = supabase
      .channel(subscriptionKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          const newTask = payload.new as any;
          const eventKey = `insert-${newTask.id}-${newTask.created_at}-${Date.now()}`;
          
          if (processedEvents.current.has(eventKey)) {
            console.log('Duplicate INSERT event prevented for task:', newTask.id);
            return;
          }
          
          processedEvents.current.add(eventKey);
          setTimeout(() => processedEvents.current.delete(eventKey), 30000);
          
          console.log('New task created:', newTask);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          
          // Skip notifications for tasks created by the current user
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
          
          // Get users in the task's department
          const { data: departmentUsers } = await supabase
            .from('user_departments')
            .select('user_id')
            .eq('department', newTask.category);

          const departmentUserIds = departmentUsers?.map(d => d.user_id) || [];
          
          // Create notifications for department users
          const notifications = [];
          
          // Determine notification priority and message
          const shouldNotifyOperations = (newTask.priority === 'critical' || newTask.priority === 'high') && 
                                        newTask.category !== 'operations';
          
          const targetDepartment = shouldNotifyOperations ? 'operations' : (newTask.category as Department);
          const notificationTitle = shouldNotifyOperations ? "New Priority Task" : "New Task Created";
          
          const taskMessage = tourName 
            ? `${shouldNotifyOperations ? 'Priority task' : 'New task'} "${taskName}" ${shouldNotifyOperations ? 'requires attention' : 'created'} for ${tourName}.`
            : `${shouldNotifyOperations ? 'Priority task' : 'New task'} "${taskName}" ${shouldNotifyOperations ? 'requires attention' : 'created'}.`;

          // Normalize priority to match expected type
          const normalizedPriority = ['low', 'medium', 'high', 'critical'].includes(newTask.priority) 
            ? newTask.priority as 'low' | 'medium' | 'high' | 'critical'
            : 'medium' as const;

          // Notify department users
          if (shouldNotifyOperations) {
            // Get operations department users
            const { data: operationsUsers } = await supabase
              .from('user_departments')
              .select('user_id')
              .eq('department', 'operations');
            
            const operationsUserIds = operationsUsers?.map(d => d.user_id) || [];
            
            for (const operationsUserId of operationsUserIds) {
              notifications.push({
                userId: operationsUserId,
                title: notificationTitle,
                message: taskMessage,
                type: 'task' as const,
                priority: normalizedPriority,
                related_id: newTask.id,
                department: 'operations' as Department,
              });
            }
          } else {
            // Notify users in the task's department
            for (const departmentUserId of departmentUserIds) {
              notifications.push({
                userId: departmentUserId,
                title: notificationTitle,
                message: taskMessage,
                type: 'task' as const,
                priority: normalizedPriority,
                related_id: newTask.id,
                department: newTask.category as Department,
              });
            }
          }

          if (notifications.length > 0) {
            await createMultipleNotifications(notifications);
          }

          // Show toast only for high priority tasks to current user if they're in the right department
          if (shouldNotifyOperations && departmentUserIds.includes(userId)) {
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
          const oldTask = payload.old as any;
          const newTask = payload.new as any;
          const eventKey = `update-${newTask.id}-${newTask.updated_at}-${Date.now()}`;
          
          if (processedEvents.current.has(eventKey)) {
            console.log('Duplicate UPDATE event prevented for task:', newTask.id);
            return;
          }
          
          processedEvents.current.add(eventKey);
          setTimeout(() => processedEvents.current.delete(eventKey), 30000);
          
          console.log('Task updated:', newTask);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          
          // Only notify on significant status changes
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

          // Get assigned users and department users
          const { data: assignedUsers } = await supabase
            .from('task_assignments')
            .select('user_id')
            .eq('task_id', newTask.id);

          const { data: departmentUsers } = await supabase
            .from('user_departments')
            .select('user_id')
            .eq('department', newTask.category);

          const assignedUserIds = assignedUsers?.map(a => a.user_id) || [];
          const departmentUserIds = departmentUsers?.map(d => d.user_id) || [];
          
          // Combine and deduplicate user IDs
          const allUserIds = Array.from(new Set([...assignedUserIds, ...departmentUserIds]));

          if (newTask.status === 'completed') {
            const { taskName, tourName } = await getTaskDetails(newTask.id);
            const taskMessage = tourName 
              ? `Task "${taskName}" for ${tourName} has been completed.`
              : `Task "${taskName}" has been completed.`;

            const notifications = allUserIds.map(notifyUserId => ({
              userId: notifyUserId,
              title: "Task Completed",
              message: taskMessage,
              type: 'task' as const,
              priority: 'medium' as const,
              related_id: newTask.id,
              department: newTask.category as Department,
            }));

            if (notifications.length > 0) {
              await createMultipleNotifications(notifications);
            }

            if (allUserIds.includes(userId)) {
              toast({
                title: "Task Completed",
                description: taskMessage,
                duration: 3000,
              });
            }
          } else if (oldTask.status === 'not_started' && newTask.status === 'in_progress') {
            const { taskName, tourName } = await getTaskDetails(newTask.id);
            const taskMessage = tourName 
              ? `Task "${taskName}" for ${tourName} has been started.`
              : `Task "${taskName}" has been started.`;

            const notifications = allUserIds.map(notifyUserId => ({
              userId: notifyUserId,
              title: "Task Started",
              message: taskMessage,
              type: 'task' as const,
              priority: 'low' as const,
              related_id: newTask.id,
              department: newTask.category as Department,
            }));

            if (notifications.length > 0) {
              await createMultipleNotifications(notifications);
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
          const deletedTask = payload.old as any;
          const taskId = deletedTask.id;
          const eventKey = `delete-${taskId}-${Date.now()}`;

          console.log('Task deleted via realtime:', { taskId, eventKey, deletedTask });

          // Enhanced duplicate prevention
          if (processedEvents.current.has(eventKey)) {
            console.log('Deletion already processed for task:', taskId);
            return;
          }
          
          // Mark this deletion as processed immediately
          processedEvents.current.add(eventKey);
          
          // Clean up after 60 seconds
          setTimeout(() => {
            processedEvents.current.delete(eventKey);
          }, 60000);

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

          // Extract task name - check both title and name fields
          let taskName = 'Unknown Task';
          if (deletedTask.title && typeof deletedTask.title === 'string' && deletedTask.title.trim() !== '') {
            taskName = deletedTask.title.trim();
          } else if (deletedTask.name && typeof deletedTask.name === 'string' && deletedTask.name.trim() !== '') {
            taskName = deletedTask.name.trim();
          }

          console.log('Extracted task name from deletion payload:', taskName);
          console.log('Full deleted task object:', deletedTask);

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
              console.log('Found tour name for deleted task:', tourName);
            } catch (error) {
              console.error('Error fetching tour name for deleted task:', error);
            }
          }

          // Get users in the task's department for notifications
          const { data: departmentUsers } = await supabase
            .from('user_departments')
            .select('user_id')
            .eq('department', deletedTask.category);

          const departmentUserIds = departmentUsers?.map(d => d.user_id) || [];

          const taskMessage = tourName 
            ? `Task "${taskName}" for ${tourName} has been deleted.`
            : `Task "${taskName}" has been deleted.`;

          console.log('Creating deletion notification:', { taskName, tourName, taskMessage });
          
          // Create notifications for department users
          const notifications = departmentUserIds.map(notifyUserId => ({
            userId: notifyUserId,
            title: "Task Deleted",
            message: taskMessage,
            type: 'task' as const,
            priority: 'medium' as const,
            related_id: deletedTask.id,
            department: deletedTask.category as Department,
          }));

          if (notifications.length > 0) {
            await createMultipleNotifications(notifications);
          }

          // Force refresh notifications to show immediately
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.refetchQueries({ queryKey: ['notifications'] });

          // Show toast notification for task deletion if user is in department
          if (departmentUserIds.includes(userId)) {
            toast({
              title: "Task Deleted",
              description: taskMessage,
              duration: 3000,
            });
          }
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
          const assignment = payload.new as any;
          const eventKey = `assignment-${assignment.id}-${assignment.assigned_at}-${Date.now()}`;
          
          if (processedEvents.current.has(eventKey)) {
            console.log('Duplicate assignment event prevented for:', assignment.id);
            return;
          }
          
          processedEvents.current.add(eventKey);
          setTimeout(() => processedEvents.current.delete(eventKey), 30000);
          
          console.log('New task assignment:', assignment);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['task-assignments'] });

          // Notify the specific user being assigned and department members
          const { taskName, tourName } = await getTaskDetails(assignment.task_id);
          const assignmentMessage = tourName 
            ? `You have been assigned to task "${taskName}" for ${tourName}.`
            : `You have been assigned to task "${taskName}".`;

          // Get task details for department notifications
          const { data: task } = await supabase
            .from('tasks')
            .select('category')
            .eq('id', assignment.task_id)
            .single();

          // Get users in the task's department
          const { data: departmentUsers } = await supabase
            .from('user_departments')
            .select('user_id')
            .eq('department', task?.category || 'general');

          const departmentUserIds = departmentUsers?.map(d => d.user_id) || [];

          // Create notifications
          const notifications = [];

          // Notify the assigned user
          notifications.push({
            userId: assignment.user_id,
            title: "Task Assigned",
            message: assignmentMessage,
            type: 'task' as const,
            priority: 'medium' as const,
            related_id: assignment.task_id,
          });

          // Notify department members (except the assigned user to avoid duplicates)
          const departmentMessage = tourName 
            ? `Task "${taskName}" for ${tourName} has been assigned.`
            : `Task "${taskName}" has been assigned.`;

          for (const departmentUserId of departmentUserIds) {
            if (departmentUserId !== assignment.user_id) {
              notifications.push({
                userId: departmentUserId,
                title: "Task Assignment Update",
                message: departmentMessage,
                type: 'task' as const,
                priority: 'low' as const,
                related_id: assignment.task_id,
                department: task?.category as Department,
              });
            }
          }

          if (notifications.length > 0) {
            await createMultipleNotifications(notifications);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_assignments'
        },
        async (payload) => {
          const deletedAssignment = payload.old as any;
          console.log('Task assignment removed:', deletedAssignment);
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['task-assignments'] });

          // Optionally notify about assignment removal
          const { taskName, tourName } = await getTaskDetails(deletedAssignment.task_id);
          const removalMessage = tourName 
            ? `You have been unassigned from task "${taskName}" for ${tourName}.`
            : `You have been unassigned from task "${taskName}".`;

          await createNotification(deletedAssignment.user_id, {
            title: "Task Assignment Removed",
            message: removalMessage,
            type: 'task',
            priority: 'low',
            related_id: deletedAssignment.task_id,
          });
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
      isInitializedRef.current = null;
      // Clear processed events on cleanup
      processedEvents.current.clear();
    };
  }, [queryClient, toast, userId, logOperation]);
};
