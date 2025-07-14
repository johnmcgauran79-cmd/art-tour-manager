
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification } from "@/utils/notificationHelpers";

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
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const newBooking = payload.new as any;
          
          // Get booking details for notification
          const { data: bookingDetails, error: bookingError } = await supabase
            .from('bookings')
            .select(`
              group_name,
              lead_passenger_id,
              tours!inner(name),
              customers(first_name, last_name)
            `)
            .eq('id', newBooking.id)
            .maybeSingle();

          if (bookingError) {
            console.error('Error fetching booking details for notification:', bookingError);
            return;
          }

          const contactName = bookingDetails?.customers 
            ? `${bookingDetails.customers.first_name} ${bookingDetails.customers.last_name}`
            : bookingDetails?.group_name || 'Unknown Contact';
          const tourName = bookingDetails?.tours?.name || 'Unknown Tour';

          console.log('Creating booking creation notification for:', contactName, 'on tour:', tourName);
          
          await createNotification('', {
            title: "New Booking Created",
            message: `New booking created for ${contactName} on "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: newBooking.id,
            department: 'operations',
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
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const oldBooking = payload.old as any;
          const newBooking = payload.new as any;
          
          // Get booking details for notification
          const { data: bookingDetails } = await supabase
            .from('bookings')
            .select(`
              group_name,
              lead_passenger_id,
              tours!inner(name),
              customers(first_name, last_name)
            `)
            .eq('id', newBooking.id)
            .single();

          const contactName = bookingDetails?.customers 
            ? `${bookingDetails.customers.first_name} ${bookingDetails.customers.last_name}`
            : bookingDetails?.group_name || 'Unknown Contact';
          const tourName = bookingDetails?.tours?.name || 'Unknown Tour';

          // Only create notifications for significant changes
          if (oldBooking.status !== newBooking.status) {
            console.log('Creating booking status change notification for:', contactName);
            
            await createNotification('', {
              title: "Booking Status Changed",
              message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking',
              priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
              related_id: newBooking.id,
              department: 'operations',
            });

          } else if (oldBooking.passenger_count !== newBooking.passenger_count) {
            console.log('Creating booking passenger count change notification for:', contactName);
            
            await createNotification('', {
              title: "Passenger Count Updated",
              message: `${contactName}'s booking for "${tourName}" passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
              department: 'operations',
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
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedBooking = payload.old as any;
          
          // Get contact and tour names from the deleted booking data
          let contactName = 'Unknown Contact';
          let tourName = 'Unknown Tour';

          // Try to get contact name from the deleted booking data
          if (deletedBooking.group_name) {
            contactName = deletedBooking.group_name;
          } else if (deletedBooking.lead_passenger_id) {
            // Try to get customer details if lead_passenger_id exists
            try {
              const { data: customer } = await supabase
                .from('customers')
                .select('first_name, last_name')
                .eq('id', deletedBooking.lead_passenger_id)
                .single();
              
              if (customer) {
                contactName = `${customer.first_name} ${customer.last_name}`;
              }
            } catch (error) {
              console.error('Error fetching customer details for deleted booking:', error);
            }
          }

          // Try to get tour name using tour_id from the deleted booking
          if (deletedBooking.tour_id) {
            try {
              const { data: tour } = await supabase
                .from('tours')
                .select('name')
                .eq('id', deletedBooking.tour_id)
                .single();
              
              if (tour) {
                tourName = tour.name;
              }
            } catch (error) {
              console.error('Error fetching tour details for deleted booking:', error);
            }
          }

          console.log('Creating booking deletion notification for:', contactName, 'from tour:', tourName);

          // Create only ONE notification for booking deletion
          await createNotification('', {
            title: "Booking Deleted",
            message: `Booking for ${contactName} has been deleted from "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: deletedBooking.id,
            department: 'operations',
          });

          logOperation({
            operation_type: 'DELETE',
            table_name: 'bookings',
            record_id: deletedBooking.id,
            details: {
              contact_name: contactName,
              tour_name: tourName,
              passenger_count: deletedBooking.passenger_count,
              deleted_by_realtime: true
            }
          });
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
