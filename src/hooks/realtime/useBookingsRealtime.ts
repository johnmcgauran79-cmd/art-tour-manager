
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification, getBookingDetails } from "@/utils/notificationHelpers";

export const useBookingsRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useBookingsRealtime');
      return;
    }

    console.log('Setting up bookings realtime subscription for user:', userId);

    const bookingsChannel = supabase
      .channel('bookings-realtime')
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

          // Get all users with relevant roles to notify - ALL booking agents, managers and admins
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager', 'booking_agent']);

          console.log('Notifying users about new booking:', usersToNotify?.length || 0, 'users');

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

          if (usersToNotify) {
            // Create notifications for all relevant users
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "New Booking",
                message: `New booking for ${contactName} on "${tourName}"`,
                type: 'booking',
                priority: 'medium',
                related_id: newBooking.id,
              });
            }
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
          console.log('Booking updated:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const oldBooking = payload.old as any;
          const newBooking = payload.new as any;
          
          const { contactName, tourName } = await getBookingDetails(newBooking.id);

          // Get all users with relevant roles to notify - ALL booking agents, managers and admins
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager', 'booking_agent']);

          console.log('Notifying users about booking update:', usersToNotify?.length || 0, 'users');

          if (oldBooking.status !== newBooking.status && usersToNotify) {
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Booking Status Changed",
                message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status}`,
                type: 'booking',
                priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
                related_id: newBooking.id,
              });
            }
          }

          if (oldBooking.passenger_count !== newBooking.passenger_count && usersToNotify) {
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Passenger Count Updated",
                message: `${contactName}'s booking for "${tourName}" passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
                type: 'booking',
                priority: 'medium',
                related_id: newBooking.id,
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
          table: 'bookings'
        },
        async (payload) => {
          console.log('Booking deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedBooking = payload.old as any;
          const { contactName, tourName } = await getBookingDetails(deletedBooking.id);

          // Get all users with relevant roles to notify - ALL booking agents, managers and admins
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager', 'booking_agent']);

          console.log('Notifying users about booking deletion:', usersToNotify?.length || 0, 'users');

          if (usersToNotify) {
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Booking Deleted",
                message: `${contactName}'s booking for "${tourName}" has been deleted`,
                type: 'booking',
                priority: 'medium',
                related_id: deletedBooking.id,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up bookings real-time subscriptions...');
      supabase.removeChannel(bookingsChannel);
    };
  }, [queryClient, userId, logOperation]);
};
