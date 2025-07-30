import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

type Department = 'operations' | 'finance' | 'marketing' | 'booking' | 'maintenance' | 'general';

// Centralized notification creation utility
const createNotificationForUsers = async (
  userIds: string[],
  notification: {
    title: string;
    message: string;
    type: string;
    priority: string;
    related_id: string;
  }
) => {
  if (userIds.length === 0) return;

  const notifications = userIds.map(userId => ({
    user_id: userId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    priority: notification.priority,
    related_id: notification.related_id,
    department: null
  }));

  const { error } = await supabase
    .from('user_notifications')
    .insert(notifications);

  if (error) {
    console.error('❌ Failed to create notifications:', error);
    return false;
  }

  console.log(`✅ Created ${notifications.length} notifications`);
  return true;
};

// Get unique users from departments (avoid duplicates)
const getUsersFromDepartments = async (departments: Department[]) => {
  const uniqueUserIds = new Set<string>();

  for (const department of departments) {
    const { data: users } = await supabase
      .from('user_departments')
      .select('user_id')
      .eq('department', department);

    if (users) {
      for (const user of users) {
        uniqueUserIds.add(user.user_id);
      }
    }
  }

  return Array.from(uniqueUserIds);
};

// Get users assigned to a task (avoid duplicates with operations)
const getTaskUsers = async (taskId: string) => {
  const uniqueUserIds = new Set<string>();

  // Get assigned users
  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('user_id')
    .eq('task_id', taskId);

  if (assignments) {
    for (const assignment of assignments) {
      uniqueUserIds.add(assignment.user_id);
    }
  }

  // Also include operations department users
  const operationsUsers = await getUsersFromDepartments(['operations']);
  for (const userId of operationsUsers) {
    uniqueUserIds.add(userId);
  }

  return Array.from(uniqueUserIds);
};

export const useNotificationSystem = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      console.log('❌ No user authenticated, skipping notification system setup');
      return;
    }

    // Prevent multiple subscriptions
    if (isSubscribedRef.current) {
      console.log('⚠️ Notification system already subscribed, skipping');
      return;
    }

    console.log('🔄 Setting up notification system for user:', user.id);
    console.log('📡 Creating real-time subscription...');

    // Create a single channel with a consistent name (not timestamp-based)
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('🆕 New booking detected:', payload.new.id);
          
          try {
            // Get booking details
            const { data: booking } = await supabase
              .from('bookings')
              .select(`
                *,
                customers(first_name, last_name),
                tours(name)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!booking) {
              console.error('❌ Could not fetch booking details');
              return;
            }

            const customerName = booking.customers
              ? `${booking.customers.first_name} ${booking.customers.last_name}`
              : booking.group_name || 'Unknown Contact';
            
            const tourName = booking.tours?.name || 'Unknown Tour';

            // Get users from operations and booking departments (deduplicated)
            const userIds = await getUsersFromDepartments(['operations', 'booking']);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: 'New Booking Created',
                message: `New booking created for ${customerName} on "${tourName}"`,
                type: 'booking',
                priority: 'medium',
                related_id: payload.new.id
              });

              if (success) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
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
          console.log('📝 Booking updated:', payload.new.id);
          console.log('📊 Booking update details:', {
            old_status: payload.old.status,
            new_status: payload.new.status,
            old_check_in: payload.old.check_in_date,
            new_check_in: payload.new.check_in_date,
            old_check_out: payload.old.check_out_date,
            new_check_out: payload.new.check_out_date,
            old_updated_at: payload.old.updated_at,
            new_updated_at: payload.new.updated_at
          });
          
          try {
            // Get booking details
            const { data: booking } = await supabase
              .from('bookings')
              .select(`
                *,
                customers(first_name, last_name),
                tours(name)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!booking) {
              console.error('❌ Could not fetch booking details for update notification');
              return;
            }

            const customerName = booking.customers
              ? `${booking.customers.first_name} ${booking.customers.last_name}`
              : booking.group_name || 'Unknown Contact';
            
            const tourName = booking.tours?.name || 'Unknown Tour';

            // Determine what changed
            let changeDescription = 'updated';
            if (payload.old.status !== payload.new.status) {
              changeDescription = `status changed to ${payload.new.status}`;
            } else if (payload.old.check_in_date !== payload.new.check_in_date || payload.old.check_out_date !== payload.new.check_out_date) {
              changeDescription = 'hotel dates updated';
            } else {
              changeDescription = 'details updated';
            }

            const userIds = await getUsersFromDepartments(['operations', 'booking']);
            console.log(`👥 Notifying ${userIds.length} users about booking update`);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: 'Booking Updated',
                message: `Booking for ${customerName} on "${tourName}" - ${changeDescription}`,
                type: 'booking',
                priority: 'medium',
                related_id: payload.new.id
              });

              if (success) {
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
          console.log('🆕 New tour detected:', payload.new.id);
          
          try {
            const userIds = await getUsersFromDepartments(['operations']);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: 'New Tour Created',
                message: `New tour "${payload.new.name}" has been created`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              });

              if (success) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in tour notification handler:', error);
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
          console.log('🆕 New task detected:', payload.new.id);
          
          try {
            const { data: task } = await supabase
              .from('tasks')
              .select(`
                title,
                description,
                priority,
                category,
                tour_id,
                is_automated,
                tours(name)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!task) return;

            const tourName = task.tours?.name || 'General';
            const taskType = task.is_automated ? 'Automated Task' : 'Task';

            const userIds = await getTaskUsers(payload.new.id);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: `New ${taskType} Created`,
                message: `New ${taskType.toLowerCase()}: "${task.title}" for ${tourName}`,
                type: 'task',
                priority: task.priority || 'medium',
                related_id: payload.new.id
              });

              if (success) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in task notification handler:', error);
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
          console.log('📝 Task updated:', payload.new.id);
          
          try {
            // Only notify if status changed to completed
            if (payload.old.status !== 'completed' && payload.new.status === 'completed') {
              const { data: task } = await supabase
                .from('tasks')
                .select(`
                  title,
                  tours(name)
                `)
                .eq('id', payload.new.id)
                .single();

              if (!task) return;

              const tourName = task.tours?.name || 'General';
              const userIds = await getTaskUsers(payload.new.id);

              if (userIds.length > 0) {
                const success = await createNotificationForUsers(userIds, {
                  title: 'Task Completed',
                  message: `Task "${task.title}" for ${tourName} has been completed`,
                  type: 'task',
                  priority: 'low',
                  related_id: payload.new.id
                });

                if (success) {
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
          table: 'hotels'
        },
        async (payload) => {
          console.log('🆕 New hotel detected:', payload.new.id);
          
          try {
            const userIds = await getUsersFromDepartments(['operations']);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: 'New Hotel Added',
                message: `New hotel "${payload.new.name}" has been added`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              });

              if (success) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in hotel notification handler:', error);
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
          console.log('🆕 New activity detected:', payload.new.id);
          
          try {
            const userIds = await getUsersFromDepartments(['operations']);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: 'New Activity Added',
                message: `New activity "${payload.new.name}" has been added`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              });

              if (success) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
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
          table: 'hotel_bookings'
        },
        async (payload) => {
          console.log('📝 Hotel booking updated:', payload.new.id);
          
          try {
            // Get the main booking to notify about hotel changes
            const { data: hotelBooking } = await supabase
              .from('hotel_bookings')
              .select(`
                booking_id,
                bookings!inner(
                  customers(first_name, last_name),
                  tours(name),
                  group_name
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (!hotelBooking) return;

            const customerName = hotelBooking.bookings.customers
              ? `${hotelBooking.bookings.customers.first_name} ${hotelBooking.bookings.customers.last_name}`
              : hotelBooking.bookings.group_name || 'Unknown Contact';
            
            const tourName = hotelBooking.bookings.tours?.name || 'Unknown Tour';

            const userIds = await getUsersFromDepartments(['operations', 'booking']);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: 'Booking Hotel Details Updated',
                message: `Hotel details updated for ${customerName} on "${tourName}"`,
                type: 'booking',
                priority: 'medium',
                related_id: hotelBooking.booking_id
              });

              if (success) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in hotel booking update notification handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'activity_bookings'
        },
        async (payload) => {
          console.log('📝 Activity booking updated:', payload.new.id);
          
          try {
            // Get the main booking to notify about activity changes
            const { data: activityBooking } = await supabase
              .from('activity_bookings')
              .select(`
                booking_id,
                bookings!inner(
                  customers(first_name, last_name),
                  tours(name),
                  group_name
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (!activityBooking) return;

            const customerName = activityBooking.bookings.customers
              ? `${activityBooking.bookings.customers.first_name} ${activityBooking.bookings.customers.last_name}`
              : activityBooking.bookings.group_name || 'Unknown Contact';
            
            const tourName = activityBooking.bookings.tours?.name || 'Unknown Tour';

            const userIds = await getUsersFromDepartments(['operations', 'booking']);

            if (userIds.length > 0) {
              const success = await createNotificationForUsers(userIds, {
                title: 'Booking Activity Details Updated',
                message: `Activity details updated for ${customerName} on "${tourName}"`,
                type: 'booking',
                priority: 'medium',
                related_id: activityBooking.booking_id
              });

              if (success) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in activity booking update notification handler:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time changes');
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Subscription failed:', status);
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up notification system');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isSubscribedRef.current = false;
    };
  }, [user?.id, queryClient]);
};