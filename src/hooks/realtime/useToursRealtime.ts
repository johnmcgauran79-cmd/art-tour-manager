
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification } from "@/utils/notificationHelpers";

export const useToursRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useToursRealtime');
      return;
    }

    console.log('Setting up tours realtime subscription for user:', userId);

    const channelName = `tours-realtime-${userId}-${Date.now()}`;
    const toursChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tours'
        },
        async (payload) => {
          console.log('New tour created:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          const newTour = payload.new as any;
          
          // New tours - notify ALL users (general notification)
          await createNotification('', {
            title: "New Tour Created",
            message: `Tour "${newTour.name}" has been created`,
            type: 'tour',
            priority: 'medium',
            related_id: newTour.id,
            department: 'general',
          });

          logOperation({
            operation_type: 'CREATE',
            table_name: 'tours',
            record_id: newTour.id,
            details: {
              tour_name: newTour.name,
              start_date: newTour.start_date,
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
          table: 'tours'
        },
        async (payload) => {
          console.log('Tour updated:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          const oldTour = payload.old as any;
          const newTour = payload.new as any;
          
          // Edited tours - notify operations department
          await createNotification('', {
            title: "Tour Updated",
            message: `Tour "${newTour.name}" has been updated`,
            type: 'tour',
            priority: 'medium',
            related_id: newTour.id,
            department: 'operations',
          });

          // Also notify users who have bookings on this tour
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select(`
              id,
              lead_passenger_id,
              customers!inner(id, email)
            `)
            .eq('tour_id', newTour.id)
            .in('status', ['fully_paid', 'deposited', 'instalment_paid']);

          if (bookingsData && bookingsData.length > 0) {
            for (const booking of bookingsData) {
              if (booking.customers) {
                // Find user ID for this customer email
                const { data: userData } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('email', booking.customers.email)
                  .single();

                if (userData) {
                  await createNotification(userData.id, {
                    title: "Your Tour Updated",
                    message: `Tour "${newTour.name}" that you have a booking for has been updated`,
                    type: 'tour',
                    priority: 'medium',
                    related_id: newTour.id,
                  });
                }
              }
            }
          }

          logOperation({
            operation_type: 'UPDATE',
            table_name: 'tours',
            record_id: newTour.id,
            details: {
              tour_name: newTour.name,
              date_changed: oldTour.start_date !== newTour.start_date,
              updated_by_realtime: true
            }
          });

          if (oldTour.start_date !== newTour.start_date) {
            await createNotification('', {
              title: "Tour Dates Updated",
              message: `${newTour.name} dates changed - tasks regenerated`,
              type: 'tour',
              priority: 'high',
              related_id: newTour.id,
              department: 'operations',
            });
          }

          if (oldTour.status !== newTour.status) {
            await createNotification('', {
              title: "Tour Status Updated",
              message: `${newTour.name} status changed from ${oldTour.status} to ${newTour.status}`,
              type: 'tour',
              priority: 'medium',
              related_id: newTour.id,
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
          table: 'tours'
        },
        async (payload) => {
          console.log('Tour deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedTour = payload.old as any;
          
          await createNotification('', {
            title: "Tour Deleted",
            message: `Tour "${deletedTour.name}" has been deleted.`,
            type: 'tour',
            priority: 'high',
            related_id: deletedTour.id,
            department: 'operations',
          });

          logOperation({
            operation_type: 'DELETE',
            table_name: 'tours',
            record_id: deletedTour.id,
            details: {
              tour_name: deletedTour.name,
              deleted_by_realtime: true
            }
          });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up tours real-time subscriptions...');
      supabase.removeChannel(toursChannel);
    };
  }, [queryClient, userId, logOperation]);
};
