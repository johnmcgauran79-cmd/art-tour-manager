
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createMultipleNotifications, getBookingDetails } from "@/utils/notificationHelpers";

export const useBookingsRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useBookingsRealtime');
      return;
    }

    console.log('Setting up bookings realtime subscription for user:', userId);

    const channelName = `bookings-realtime-${userId}-${Date.now()}`;
    const bookingsChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('New booking created:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const newBooking = payload.new as any;
          const { contactName, tourName } = await getBookingDetails(newBooking.id);

          console.log('About to create multiple notifications for new booking');
          
          // Create notifications for multiple recipients
          await createMultipleNotifications([
            // Notification for the user who created the booking
            {
              userId: userId,
              title: "New Booking Created",
              message: `You created a new booking for ${contactName} on "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            },
            // General notification for operations department
            {
              title: "New Booking Created",
              message: `New booking for ${contactName} on "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
              department: 'operations',
            },
            // General notification for booking department
            {
              title: "New Booking Created",
              message: `New booking for ${contactName} on "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
              department: 'booking',
            }
          ]);

          logOperation({
            operation_type: 'CREATE',
            table_name: 'bookings',
            record_id: newBooking.id,
            details: {
              contact_name: contactName,
              tour_name: tourName,
              passenger_count: newBooking.passenger_count,
              created_by_realtime: true
            }
          });
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
          console.log('Booking updated:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const oldBooking = payload.old as any;
          const newBooking = payload.new as any;
          const { contactName, tourName } = await getBookingDetails(newBooking.id);

          console.log('About to create multiple notifications for booking update');

          const notifications = [];

          // Status change notifications
          if (oldBooking.status !== newBooking.status) {
            // Notification for the user who updated the booking
            notifications.push({
              userId: userId,
              title: "Booking Status Changed",
              message: `You changed ${contactName}'s booking for "${tourName}" from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking' as const,
              priority: newBooking.status === 'cancelled' ? 'high' as const : 'medium' as const,
              related_id: newBooking.id,
            });

            // General notification for operations department
            notifications.push({
              title: "Booking Status Changed",
              message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking' as const,
              priority: newBooking.status === 'cancelled' ? 'high' as const : 'medium' as const,
              related_id: newBooking.id,
              department: 'operations' as const,
            });

            // If booking is cancelled, also notify finance
            if (newBooking.status === 'cancelled') {
              notifications.push({
                title: "Booking Cancelled",
                message: `${contactName}'s booking for "${tourName}" has been cancelled - may require refund processing`,
                type: 'booking' as const,
                priority: 'high' as const,
                related_id: newBooking.id,
                department: 'finance' as const,
              });
            }
          }

          // Passenger count change notifications
          if (oldBooking.passenger_count !== newBooking.passenger_count) {
            notifications.push({
              userId: userId,
              title: "Passenger Count Updated",
              message: `You updated ${contactName}'s booking for "${tourName}" passenger count from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
              type: 'booking' as const,
              priority: 'medium' as const,
              related_id: newBooking.id,
            });

            notifications.push({
              title: "Passenger Count Updated",
              message: `${contactName}'s booking for "${tourName}" passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
              type: 'booking' as const,
              priority: 'medium' as const,
              related_id: newBooking.id,
              department: 'operations' as const,
            });
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
          table: 'bookings'
        },
        async (payload) => {
          console.log('Booking deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedBooking = payload.old as any;
          const { contactName, tourName } = await getBookingDetails(deletedBooking.id);

          console.log('About to create multiple notifications for booking deletion');

          await createMultipleNotifications([
            // Notification for the user who deleted the booking
            {
              userId: userId,
              title: "Booking Deleted",
              message: `You deleted ${contactName}'s booking for "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: deletedBooking.id,
            },
            // General notification for operations department
            {
              title: "Booking Deleted",
              message: `${contactName}'s booking for "${tourName}" has been deleted`,
              type: 'booking',
              priority: 'medium',
              related_id: deletedBooking.id,
              department: 'operations',
            },
            // General notification for booking department
            {
              title: "Booking Deleted",
              message: `${contactName}'s booking for "${tourName}" has been deleted`,
              type: 'booking',
              priority: 'medium',
              related_id: deletedBooking.id,
              department: 'booking',
            }
          ]);
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up bookings real-time subscriptions...');
      supabase.removeChannel(bookingsChannel);
    };
  }, [queryClient, userId, logOperation]);
};
