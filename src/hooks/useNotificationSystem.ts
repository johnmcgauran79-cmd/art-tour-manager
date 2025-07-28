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

    console.log('🔧 Setting up centralized notification system for user:', user.id);

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
          console.log('🆕 New booking detected:', payload.new);
          
          try {
            // Get user info
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single();
            
            const userName = userProfile 
              ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
              : 'Unknown User';

            // Get booking details
            const { data: booking } = await supabase
              .from('bookings')
              .select(`
                group_name,
                customers(first_name, last_name),
                tours(name)
              `)
              .eq('id', payload.new.id)
              .single();

            const contactName = booking?.customers 
              ? `${booking.customers.first_name} ${booking.customers.last_name}`
              : booking?.group_name || 'Unknown Contact';
            const tourName = booking?.tours?.name || 'Unknown Tour';

            // Create notifications for departments
            const notifications = [
              {
                user_id: null,
                title: 'New Booking Created',
                message: `New booking created by ${userName} for ${contactName} on "${tourName}"`,
                type: 'booking' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
              },
              {
                user_id: null,
                title: 'New Booking Created',
                message: `New booking created by ${userName} for ${contactName} on "${tourName}"`,
                type: 'booking' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'booking' as const
              }
            ];

            console.log('🔔 Creating booking notifications:', notifications);

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

          console.log('📝 Booking update detected:', { 
            id: newBooking.id, 
            oldStatus: oldBooking.status, 
            newStatus: newBooking.status 
          });

          try {
            // Only notify on status changes
            if (oldBooking.status !== newBooking.status) {
              // Get user info
              const { data: userProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();
              
              const userName = userProfile 
                ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
                : 'Unknown User';

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
                  title: 'Booking Status Changed',
                  message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status} by ${userName}`,
                  type: 'booking' as const,
                  priority,
                  related_id: newBooking.id,
                  department: 'operations' as const
                },
                {
                  user_id: null,
                  title: 'Booking Status Changed',
                  message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status} by ${userName}`,
                  type: 'booking' as const,
                  priority,
                  related_id: newBooking.id,
                  department: 'booking' as const
                }
              ];

              console.log('🔔 Creating status change notifications:', notifications);

              const { error } = await supabase
                .from('user_notifications')
                .insert(notifications);

              if (error) {
                console.error('❌ Failed to create status change notifications:', error);
              } else {
                console.log('✅ Status change notifications created successfully');
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
          console.log('🆕 New tour detected:', payload.new);
          
          try {
            // Get user info
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single();
            
            const userName = userProfile 
              ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
              : 'Unknown User';

            const notifications = [
              {
                user_id: null,
                title: 'New Tour Created',
                message: `New tour "${payload.new.name}" created by ${userName}`,
                type: 'tour' as const,
                priority: 'medium' as const,
                related_id: payload.new.id,
                department: 'operations' as const
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