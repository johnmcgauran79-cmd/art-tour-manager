
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createMultipleNotifications } from "@/utils/notificationHelpers";

export const useBookingsRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useBookingsRealtime');
      return;
    }

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      console.log('Bookings realtime already subscribed, skipping...');
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
          
          // Get booking details for notification
          const { data: bookingDetails } = await supabase
            .from('bookings')
            .select(`
              group_name,
              lead_passenger_id,
              tours(name),
              customers(first_name, last_name)
            `)
            .eq('id', newBooking.id)
            .single();

          const contactName = bookingDetails?.customers 
            ? `${bookingDetails.customers.first_name} ${bookingDetails.customers.last_name}`
            : bookingDetails?.group_name || 'Unknown Contact';
          const tourName = bookingDetails?.tours?.name || 'Unknown Tour';

          console.log('Creating booking creation notifications');
          
          // Create only ONE set of notifications for booking creation
          await createMultipleNotifications([
            // Personal notification for the user who created the booking
            {
              userId: userId,
              title: "New Booking Created",
              message: `You created a new booking for ${contactName} on "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            },
            // Single department notification for operations
            {
              title: "New Booking Created",
              message: `New booking for ${contactName} on "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
              department: 'operations',
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
          
          // Get booking details for notification
          const { data: bookingDetails } = await supabase
            .from('bookings')
            .select(`
              group_name,
              lead_passenger_id,
              tours(name),
              customers(first_name, last_name)
            `)
            .eq('id', newBooking.id)
            .single();

          const contactName = bookingDetails?.customers 
            ? `${bookingDetails.customers.first_name} ${bookingDetails.customers.last_name}`
            : bookingDetails?.group_name || 'Unknown Contact';
          const tourName = bookingDetails?.tours?.name || 'Unknown Tour';

          const notifications = [];

          // Only create notifications for significant changes
          if (oldBooking.status !== newBooking.status) {
            // Status change notifications
            notifications.push({
              userId: userId,
              title: "Booking Status Changed",
              message: `You changed ${contactName}'s booking for "${tourName}" from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking' as const,
              priority: newBooking.status === 'cancelled' ? 'high' as const : 'medium' as const,
              related_id: newBooking.id,
            });

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
          } else if (oldBooking.passenger_count !== newBooking.passenger_count) {
            // Passenger count change notifications (only if status didn't change)
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
            console.log('Creating booking update notifications:', notifications.length);
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
          
          // For deletion, we need to reconstruct the names from the old data
          // Since the booking is already deleted, we can't query for related data
          let contactName = 'Unknown Contact';
          let tourName = 'Unknown Tour';

          // Try to get contact name from the deleted booking data
          if (deletedBooking.group_name) {
            contactName = deletedBooking.group_name;
          } else if (deletedBooking.lead_passenger_id) {
            // Try to get customer details if lead_passenger_id exists
            const { data: customer } = await supabase
              .from('customers')
              .select('first_name, last_name')
              .eq('id', deletedBooking.lead_passenger_id)
              .single();
            
            if (customer) {
              contactName = `${customer.first_name} ${customer.last_name}`;
            }
          }

          // Try to get tour name
          if (deletedBooking.tour_id) {
            const { data: tour } = await supabase
              .from('tours')
              .select('name')
              .eq('id', deletedBooking.tour_id)
              .single();
            
            if (tour) {
              tourName = tour.name;
            }
          }

          console.log('Creating booking deletion notifications');

          await createMultipleNotifications([
            // Personal notification for the user who deleted the booking
            {
              userId: userId,
              title: "Booking Deleted",
              message: `Booking for ${contactName} has been deleted from "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: deletedBooking.id,
            },
            // Single department notification for operations
            {
              title: "Booking Deleted",
              message: `Booking for ${contactName} has been deleted from "${tourName}"`,
              type: 'booking',
              priority: 'medium',
              related_id: deletedBooking.id,
              department: 'operations',
            }
          ]);
        }
      )
      .subscribe();

    channelRef.current = bookingsChannel;

    return () => {
      console.log('Cleaning up bookings real-time subscriptions...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, userId, logOperation]);
};
