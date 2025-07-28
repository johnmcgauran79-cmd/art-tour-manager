import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { createDepartmentNotifications } from '@/utils/notificationUtils';

export const useNotificationSystem = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('🔄 Setting up notification system for user:', user?.id);
    
    if (!user?.id) {
      console.log('❌ No user authenticated, skipping notification system setup');
      return;
    }

    console.log('✅ Starting real-time notification subscription');

    // Create a single channel for all notifications with a unique name
    const channel = supabase
      .channel(`global-notifications-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('🆕 New booking detected:', payload.new);
          
          try {
            // Get booking details
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

            if (!booking) {
              console.error('❌ Could not fetch booking details');
              return;
            }

            const contactName = booking.customers 
              ? `${booking.customers.first_name} ${booking.customers.last_name}`
              : booking.group_name || 'Unknown Contact';
            const tourName = booking.tours?.name || 'Unknown Tour';

            console.log('📝 Creating notifications for booking:', contactName, 'on', tourName);

            // Create notifications for operations and booking departments
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

            console.log('📤 Inserting notifications:', notifications.length, 'notifications');

            if (notifications.length > 0) {
              const { error } = await supabase
                .from('user_notifications')
                .insert(notifications);

              if (error) {
                console.error('❌ Failed to create booking notifications:', error);
              } else {
                console.log('✅ Booking notifications created successfully');
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
          event: 'INSERT',
          schema: 'public',
          table: 'tours'
        },
        async (payload) => {
          console.log('🆕 New tour detected:', payload.new);
          
          try {
            // Create notifications for operations department about new tours
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: 'New Tour Created',
                message: `New tour "${payload.new.name}" has been created`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            console.log('📤 Creating tour notifications:', notifications.length, 'notifications');

            if (notifications.length > 0) {
              const { error } = await supabase
                .from('user_notifications')
                .insert(notifications);

              if (error) {
                console.error('❌ Failed to create tour notifications:', error);
              } else {
                console.log('✅ Tour notifications created successfully');
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
          console.log('🆕 New task detected:', payload.new);
          
          try {
            // Get task details
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

            const tourName = task?.tours?.name || 'General';
            const taskType = task?.is_automated ? 'Automated Task' : 'Task';

            // Create notifications for operations department for all tasks
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: `New ${taskType} Created`,
                message: `New ${taskType.toLowerCase()}: "${task?.title}" for ${tourName}`,
                type: 'task',
                priority: task?.priority || 'medium',
                related_id: payload.new.id
              }
            );

            console.log('📤 Creating task notifications:', notifications.length, 'notifications');

            if (notifications.length > 0) {
              const { error } = await supabase
                .from('user_notifications')
                .insert(notifications);

              if (error) {
                console.error('❌ Failed to create task notifications:', error);
              } else {
                console.log('✅ Task notifications created successfully');
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
          event: 'INSERT',
          schema: 'public',
          table: 'hotels'
        },
        async (payload) => {
          console.log('🆕 New hotel detected:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: 'New Hotel Added',
                message: `New hotel "${payload.new.name}" has been added`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            if (notifications.length > 0) {
              const { error } = await supabase
                .from('user_notifications')
                .insert(notifications);

              if (error) {
                console.error('❌ Failed to create hotel notifications:', error);
              } else {
                console.log('✅ Hotel notifications created successfully');
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
          console.log('🆕 New activity detected:', payload.new);
          
          try {
            const notifications = await createDepartmentNotifications(
              ['operations'],
              {
                title: 'New Activity Added',
                message: `New activity "${payload.new.name}" has been added`,
                type: 'tour',
                priority: 'medium',
                related_id: payload.new.id
              }
            );

            if (notifications.length > 0) {
              const { error } = await supabase
                .from('user_notifications')
                .insert(notifications);

              if (error) {
                console.error('❌ Failed to create activity notifications:', error);
              } else {
                console.log('✅ Activity notifications created successfully');
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          } catch (error) {
            console.error('❌ Error in activity notification handler:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time changes');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Subscription failed:', status);
        }
      });

    console.log('🔧 Notification system channel created');

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up notification system');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};