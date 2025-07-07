
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

          // New bookings - notify ALL users (department-based notification)
          await createNotification('', {
            title: "New Booking",
            message: `New booking for ${contactName} on "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: newBooking.id,
            department: 'general', // Send to all departments
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

          // Edited bookings - notify Operations & Booking departments
          if (oldBooking.status !== newBooking.status) {
            await createNotification('', {
              title: "Booking Status Changed",
              message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking',
              priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
              related_id: newBooking.id,
              department: 'operations',
            });

            await createNotification('', {
              title: "Booking Status Changed",
              message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking',
              priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
              related_id: newBooking.id,
              department: 'booking',
            });
          }

          if (oldBooking.passenger_count !== newBooking.passenger_count) {
            await createNotification('', {
              title: "Passenger Count Updated",
              message: `${contactName}'s booking for "${tourName}" passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
              department: 'operations',
            });

            await createNotification('', {
              title: "Passenger Count Updated",
              message: `${contactName}'s booking for "${tourName}" passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
              department: 'booking',
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

          await createNotification('', {
            title: "Booking Deleted",
            message: `${contactName}'s booking for "${tourName}" has been deleted`,
            type: 'booking',
            priority: 'medium',
            related_id: deletedBooking.id,
            department: 'operations',
          });

          await createNotification('', {
            title: "Booking Deleted",
            message: `${contactName}'s booking for "${tourName}" has been deleted`,
            type: 'booking',
            priority: 'medium',
            related_id: deletedBooking.id,
            department: 'booking',
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
