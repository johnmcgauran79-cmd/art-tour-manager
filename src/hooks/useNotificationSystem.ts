import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export const useNotificationSystem = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);

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
      .channel(`notifications-system-${user.id}`)
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

            // Create notifications for departments - notify ALL departments regardless of who created it
            const notifications = [
              {
                user_id: null,
                title: 'New Booking Created',
                message: `New booking created for ${contactName} on "${tourName}"`,
                type: 'booking' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              },
              {
                user_id: null,
                title: 'New Booking Created', 
                message: `New booking created for ${contactName} on "${tourName}"`,
                type: 'booking' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'booking' as const
              }
            ];

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

              // Create notifications for departments
              const priority = newBooking.status === 'cancelled' ? 'high' as const : 'medium' as const;
              const notifications = [
                {
                  user_id: null,
                  title: 'Booking Updated',
                  message: `${contactName}'s booking for "${tourName}" has been updated`,
                  type: 'booking' as const,
                  priority,
                  related_id: newBooking.id,
                  department: 'operations' as const
                },
                {
                  user_id: null,
                  title: 'Booking Updated',
                  message: `${contactName}'s booking for "${tourName}" has been updated`,
                  type: 'booking' as const,
                  priority,
                  related_id: newBooking.id,
                  department: 'booking' as const
                }
              ];

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
            const notifications = [
              {
                user_id: null,
                title: 'New Tour Created',
                message: `New tour "${payload.new.name}" has been created`,
                type: 'tour' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              },
              {
                user_id: null,
                title: 'New Tour Created',
                message: `New tour "${payload.new.name}" has been created`,
                type: 'tour' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'booking' as const
              }
            ];

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
            const notifications = [
              {
                user_id: null,
                title: 'Tour Updated',
                message: `Tour "${payload.new.name}" has been updated`,
                type: 'tour' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              },
              {
                user_id: null,
                title: 'Tour Updated',
                message: `Tour "${payload.new.name}" has been updated`,
                type: 'tour' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'booking' as const
              }
            ];

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
            const notifications = [
              {
                user_id: null,
                title: 'Hotel Added',
                message: `Hotel "${payload.new.name}" has been added`,
                type: 'hotel' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              }
            ];

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
            const notifications = [
              {
                user_id: null,
                title: 'Hotel Updated',
                message: `Hotel "${payload.new.name}" has been updated`,
                type: 'hotel' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              }
            ];

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
            const notifications = [
              {
                user_id: null,
                title: 'Activity Added',
                message: `Activity "${payload.new.name}" has been added`,
                type: 'activity' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              }
            ];

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
            const notifications = [
              {
                user_id: null,
                title: 'Activity Updated',
                message: `Activity "${payload.new.name}" has been updated`,
                type: 'activity' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              }
            ];

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
      .subscribe((status) => {
        console.log('📡 Notification system subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🎉 Notification system successfully subscribed!');
          subscriptionRef.current = channel;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Notification system subscription error');
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
  }, [user?.id, queryClient]);

  return null;
};