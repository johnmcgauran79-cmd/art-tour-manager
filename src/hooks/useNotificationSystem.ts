import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { createDepartmentNotifications } from '@/utils/notificationUtils';

export const useNotificationSystem = () => {
  console.log('🎯 useNotificationSystem hook called');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);

  console.log('🎯 useNotificationSystem hook initialized', { userId: user?.id });

  useEffect(() => {
    console.log('🔄 useNotificationSystem effect triggered', { 
      userId: user?.id, 
      hasSubscription: !!subscriptionRef.current 
    });
    
    if (!user?.id) {
      console.log('🚫 No user authenticated, skipping notification system setup');
      return;
    }

    // Prevent duplicate subscriptions
    if (subscriptionRef.current) {
      console.log('⏭️ Subscription already exists, skipping');
      return;
    }

    console.log('🔧 Setting up global notification system for all changes');

    // Create a single channel for all notifications
    const channel = supabase
      .channel(`notifications-system-${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('🆕 New booking detected by ANY user:', payload.new);
          
          try {
            // Get booking details with creator info via audit log
            const { data: booking } = await supabase
              .from('bookings')
              .select(`
                group_name,
                created_at,
                customers(first_name, last_name),
                tours(name)
              `)
              .eq('id', payload.new.id)
              .single();

            const contactName = booking?.customers 
              ? `${booking.customers.first_name} ${booking.customers.last_name}`
              : booking?.group_name || 'Unknown Contact';
            const tourName = booking?.tours?.name || 'Unknown Tour';

            // Create individual notifications for each user in departments
            const notifications = await createDepartmentNotifications(
              ['operations', 'booking'],
              {
                title: 'New Booking Created',
                message: `New booking created for ${contactName} on "${tourName}"`,
                type: 'booking',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            console.log('🔔 Creating booking notifications for all departments:', notifications);

            const { error } = await supabase
              .from('user_notifications')
              .insert(notifications);

            if (error) {
              console.error('❌ Failed to create booking notifications:', error);
            } else {
              console.log('✅ Booking notifications created successfully');
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          } catch (error) {
            console.error('❌ Error in booking notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          const oldBooking = payload.old as any;
          const newBooking = payload.new as any;

          console.log('📝 Booking update detected by ANY user:', { 
            id: newBooking.id, 
            oldStatus: oldBooking.status, 
            newStatus: newBooking.status 
          });

          try {
            // Notify on any significant changes (status or other important fields)
            if (oldBooking.status !== newBooking.status || 
                oldBooking.passenger_count !== newBooking.passenger_count ||
                oldBooking.accommodation_required !== newBooking.accommodation_required) {
              
              // Get booking details
              const { data: booking } = await supabase
                .from('bookings')
                .select(`
                  group_name,
                  customers(first_name, last_name),
                  tours(name)
                `)
                .eq('id', newBooking.id)
                .single();

              const contactName = booking?.customers 
                ? `${booking.customers.first_name} ${booking.customers.last_name}`
                : booking?.group_name || 'Unknown Contact';
              const tourName = booking?.tours?.name || 'Unknown Tour';

              const priority = newBooking.status === 'cancelled' ? 'high' as const : 'medium' as const;
              
              // Create individual notifications for each user in departments
              const notifications = await createDepartmentNotifications(
                ['operations', 'booking'],
                {
                  title: 'Booking Updated',
                  message: `${contactName}'s booking for "${tourName}" has been updated`,
                  type: 'booking',
                  priority,
                  related_id: newBooking.id
                }
              );

              console.log('🔔 Creating booking update notifications:', notifications);

              const { error } = await supabase
                .from('user_notifications')
                .insert(notifications);

              if (error) {
                console.error('❌ Failed to create booking update notifications:', error);
              } else {
                console.log('✅ Booking update notifications created successfully');
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in booking update notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tours'
        },
        async (payload) => {
          console.log('🆕 New tour detected by ANY user:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations', 'booking'],
              {
                title: 'New Tour Created',
                message: `New tour "${payload.new.name}" has been created`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            const { error } = await supabase
              .from('user_notifications')
              .insert(notifications);

            if (error) {
              console.error('❌ Failed to create tour notifications:', error);
            } else {
              console.log('✅ Tour notifications created successfully');
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          } catch (error) {
            console.error('❌ Error in tour notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tours'
        },
        async (payload) => {
          console.log('📝 Tour update detected by ANY user:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations', 'booking'],
              {
                title: 'Tour Updated',
                message: `Tour "${payload.new.name}" has been updated`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            const { error } = await supabase
              .from('user_notifications')
              .insert(notifications);

            if (error) {
              console.error('❌ Failed to create tour update notifications:', error);
            } else {
              console.log('✅ Tour update notifications created successfully');
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          } catch (error) {
            console.error('❌ Error in tour update notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hotels'
        },
        async (payload) => {
          console.log('🆕 New hotel detected by ANY user:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: 'Hotel Added',
                message: `Hotel "${payload.new.name}" has been added`,
                type: 'hotel',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            const { error } = await supabase
              .from('user_notifications')
              .insert(notifications);

            if (error) {
              console.error('❌ Failed to create hotel notifications:', error);
            } else {
              console.log('✅ Hotel notifications created successfully');
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          } catch (error) {
            console.error('❌ Error in hotel notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hotels'
        },
        async (payload) => {
          console.log('📝 Hotel update detected by ANY user:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: 'Hotel Updated',
                message: `Hotel "${payload.new.name}" has been updated`,
                type: 'hotel',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            const { error } = await supabase
              .from('user_notifications')
              .insert(notifications);

            if (error) {
              console.error('❌ Failed to create hotel update notifications:', error);
            } else {
              console.log('✅ Hotel update notifications created successfully');
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          } catch (error) {
            console.error('❌ Error in hotel update notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities'
        },
        async (payload) => {
          console.log('🆕 New activity detected by ANY user:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: 'Activity Added',
                message: `Activity "${payload.new.name}" has been added`,
                type: 'activity',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            const { error } = await supabase
              .from('user_notifications')
              .insert(notifications);

            if (error) {
              console.error('❌ Failed to create activity notifications:', error);
            } else {
              console.log('✅ Activity notifications created successfully');
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          } catch (error) {
            console.error('❌ Error in activity notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'activities'
        },
        async (payload) => {
          console.log('📝 Activity update detected by ANY user:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: 'Activity Updated',
                message: `Activity "${payload.new.name}" has been updated`,
                type: 'activity',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            const { error } = await supabase
              .from('user_notifications')
              .insert(notifications);

            if (error) {
              console.error('❌ Failed to create activity update notifications:', error);
            } else {
              console.log('✅ Activity update notifications created successfully');
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          } catch (error) {
            console.error('❌ Error in activity update notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          console.log('🆕 New task detected by ANY user:', payload.new);
          
          try {
            // Get task details with creator info
            const { data: task } = await supabase
              .from('tasks')
              .select(`
                title,
                description,
                priority,
                category,
                created_by,
                tour_id,
                tours(name)
              `)
              .eq('id', payload.new.id)
              .single();

            const tourInfo = task?.tours?.name ? ` for tour "${task.tours.name}"` : '';

            // Get assigned users for this task
            const { data: assignments } = await supabase
              .from('task_assignments')
              .select('user_id')
              .eq('task_id', payload.new.id);

            // Handle individual user assignments
            if (assignments && assignments.length > 0) {
              const notifications = [];
              
              for (const assignment of assignments) {
                // Don't notify the creator if they assigned it to themselves
                if (assignment.user_id !== task?.created_by) {
                  notifications.push({
                    user_id: assignment.user_id,
                    title: 'New Task Assigned',
                    message: `You have been assigned a new ${task?.priority || 'medium'} priority task: "${task?.title}"${tourInfo}`,
                    type: 'task',
                    priority: task?.priority || 'medium',
                    related_id: payload.new.id,
                    department: null
                  });
                }
              }

              if (notifications.length > 0) {
                const { error } = await supabase
                  .from('user_notifications')
                  .insert(notifications);

                if (error) {
                  console.error('❌ Failed to create task assignment notifications:', error);
                } else {
                  console.log('✅ Task assignment notifications created successfully');
                  queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
              }
            }

            // Also notify users in the task's department category (if no individual assignments or as additional notification)
            if (task?.category && (!assignments || assignments.length === 0)) {
              const departmentNotifications = await createDepartmentNotifications(
                [task.category as any],
                {
                  title: 'New Task in Your Department',
                  message: `A new ${task?.priority || 'medium'} priority task has been created in ${task.category}: "${task?.title}"${tourInfo}`,
                  type: 'task',
                  priority: task?.priority || 'medium',
                  related_id: payload.new.id
                }
              );

              if (departmentNotifications.length > 0) {
                const { error } = await supabase
                  .from('user_notifications')
                  .insert(departmentNotifications);

                if (error) {
                  console.error('❌ Failed to create task department notifications:', error);
                } else {
                  console.log('✅ Task department notifications created successfully');
                  queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
              }
            }
          } catch (error) {
            console.error('❌ Error in task creation notification handler:', error);
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

          console.log('📝 Task update detected by ANY user:', { 
            id: newTask.id, 
            oldStatus: oldTask.status, 
            newStatus: newTask.status 
          });

          try {
            // Notify on significant changes (status, priority, or assignment changes)
            if (oldTask.status !== newTask.status || 
                oldTask.priority !== newTask.priority ||
                oldTask.due_date !== newTask.due_date) {
              
              // Get task details
              const { data: task } = await supabase
                .from('tasks')
                .select(`
                  title,
                  description,
                  status,
                  priority,
                  tour_id,
                  tours(name)
                `)
                .eq('id', newTask.id)
                .single();

              const tourInfo = task?.tours?.name ? ` for tour "${task.tours.name}"` : '';

              // Get assigned users for this task
              const { data: assignments } = await supabase
                .from('task_assignments')
                .select('user_id')
                .eq('task_id', newTask.id);

              if (assignments && assignments.length > 0) {
                const notifications = [];
                
                let changeMessage = '';
                if (oldTask.status !== newTask.status) {
                  changeMessage = `Task status changed from ${oldTask.status} to ${newTask.status}`;
                } else if (oldTask.priority !== newTask.priority) {
                  changeMessage = `Task priority changed from ${oldTask.priority} to ${newTask.priority}`;
                } else if (oldTask.due_date !== newTask.due_date) {
                  changeMessage = `Task due date has been updated`;
                } else {
                  changeMessage = `Task has been updated`;
                }
                
                for (const assignment of assignments) {
                  notifications.push({
                    user_id: assignment.user_id,
                    title: 'Task Updated',
                    message: `${changeMessage}: "${task?.title}"${tourInfo}`,
                    type: 'task',
                    priority: newTask.status === 'completed' ? 'low' : (task?.priority || 'medium'),
                    related_id: newTask.id,
                    department: null
                  });
                }

                const { error } = await supabase
                  .from('user_notifications')
                  .insert(notifications);

                if (error) {
                  console.error('❌ Failed to create task update notifications:', error);
                } else {
                  console.log('✅ Task update notifications created successfully');
                  queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
              }
            }
          } catch (error) {
            console.error('❌ Error in task update notification handler:', error);
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
          console.log('🆕 New task assignment detected:', payload.new);
          
          try {
            // Get task details
            const { data: task } = await supabase
              .from('tasks')
              .select(`
                title,
                description,
                status,
                priority,
                category,
                tour_id,
                created_by,
                tours(name)
              `)
              .eq('id', payload.new.task_id)
              .single();

            const tourInfo = task?.tours?.name ? ` for tour "${task.tours.name}"` : '';

            // Only notify if the assigned user is not the task creator (to avoid self-notification)
            if (payload.new.user_id !== task?.created_by) {
              const notification = {
                user_id: payload.new.user_id,
                title: 'Task Assigned to You',
                message: `You have been assigned to task: "${task?.title}"${tourInfo}`,
                type: 'task',
                priority: task?.priority || 'medium',
                related_id: payload.new.task_id,
                department: null
              };

              const { error } = await supabase
                .from('user_notifications')
                .insert([notification]);

              if (error) {
                console.error('❌ Failed to create task assignment notification:', error);
              } else {
                console.log('✅ Task assignment notification created successfully');
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in task assignment notification handler:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Notification system subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🎉 Notification system successfully subscribed!');
          subscriptionRef.current = channel;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Notification system subscription error');
          subscriptionRef.current = null;
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Notification subscription timed out - will retry');
          subscriptionRef.current = null;
        } else if (status === 'CLOSED') {
          console.log('🔒 Notification subscription closed');
          subscriptionRef.current = null;
        }
      });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up notification system...');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user?.id]); // Removed queryClient from dependencies to prevent unnecessary re-subscriptions

  return null;
};