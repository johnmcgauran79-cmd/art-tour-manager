import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { createDepartmentNotifications } from '@/utils/notificationUtils';
import { createTaskNotifications } from '@/utils/taskNotificationUtils';

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
            // Get booking details with separate queries to avoid join issues
            const { data: booking, error: bookingError } = await supabase
              .from('bookings')
              .select('*')
              .eq('id', payload.new.id)
              .single();

            if (bookingError || !booking) {
              console.error('❌ Could not fetch booking details:', bookingError);
              return;
            }

            console.log('📋 Booking data:', booking);

            // Get customer details if lead_passenger_id exists
            let customerName = booking.group_name || 'Unknown Contact';
            if (booking.lead_passenger_id) {
              const { data: customer } = await supabase
                .from('customers')
                .select('first_name, last_name')
                .eq('id', booking.lead_passenger_id)
                .single();
              
              if (customer) {
                customerName = `${customer.first_name} ${customer.last_name}`;
              }
            }

            // Get tour details
            let tourName = 'Unknown Tour';
            if (booking.tour_id) {
              const { data: tour } = await supabase
                .from('tours')
                .select('name')
                .eq('id', booking.tour_id)
                .single();
              
              if (tour) {
                tourName = tour.name;
              }
            }

            console.log('📝 Creating notifications for booking:', customerName, 'on', tourName);

            // Create notifications for operations and booking departments
            const notifications = await createDepartmentNotifications(
              ['operations', 'booking'],
              {
                title: 'New Booking Created',
                message: `New booking created for ${customerName} on "${tourName}"`,
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
            // Create notifications for operations and booking departments about new tours
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

            // Create notifications for assigned users and operations department
            const notifications = await createTaskNotifications(
              payload.new.id,
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