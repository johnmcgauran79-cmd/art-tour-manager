
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

          console.log('About to create notification for new booking');
          
          // Create notification for the current user (the one who created the booking)
          await createNotification(userId, {
            title: "New Booking Created",
            message: `New booking for ${contactName} on "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: newBooking.id,
          });

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

          console.log('About to create notification for booking update');

          // Status change notifications
          if (oldBooking.status !== newBooking.status) {
            await createNotification(userId, {
              title: "Booking Status Changed",
              message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking',
              priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
              related_id: newBooking.id,
            });
          }

          // Passenger count change notifications
          if (oldBooking.passenger_count !== newBooking.passenger_count) {
            await createNotification(userId, {
              title: "Passenger Count Updated",
              message: `${contactName}'s booking for "${tourName}" passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            });
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

          console.log('About to create notification for booking deletion');

          await createNotification(userId, {
            title: "Booking Deleted",
            message: `${contactName}'s booking for "${tourName}" has been deleted`,
            type: 'booking',
            priority: 'medium',
            related_id: deletedBooking.id,
          });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up bookings real-time subscriptions...');
      supabase.removeChannel(bookingsChannel);
    };
  }, [queryClient, userId, logOperation]);
};
