
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

    const toursChannel = supabase
      .channel('tours-realtime')
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
          
          // Get all users with relevant roles to notify (managers, admins, and booking agents)
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager', 'booking_agent']);

          console.log('Notifying users about new tour:', usersToNotify?.length || 0, 'users');

          if (usersToNotify) {
            // Create notifications for all relevant users
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "New Tour Created",
                message: `Tour "${newTour.name}" has been created`,
                type: 'tour',
                priority: 'medium',
                related_id: newTour.id,
              });
            }
          }

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
          
          // Get all users with relevant roles to notify (managers and admins for tour updates)
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager']);

          console.log('Notifying users about tour update:', usersToNotify?.length || 0, 'users');

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
          
          if (oldTour.start_date !== newTour.start_date && usersToNotify) {
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Tour Dates Updated",
                message: `${newTour.name} dates changed - tasks regenerated`,
                type: 'tour',
                priority: 'high',
                related_id: newTour.id,
              });
            }
          }

          // Notify about status changes
          if (oldTour.status !== newTour.status && usersToNotify) {
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Tour Status Updated",
                message: `${newTour.name} status changed from ${oldTour.status} to ${newTour.status}`,
                type: 'tour',
                priority: 'medium',
                related_id: newTour.id,
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
          table: 'tours'
        },
        async (payload) => {
          console.log('Tour deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedTour = payload.old as any;
          
          // Get all users with relevant roles to notify (managers and admins)
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager']);

          console.log('Notifying users about tour deletion:', usersToNotify?.length || 0, 'users');

          logOperation({
            operation_type: 'DELETE',
            table_name: 'tours',
            record_id: deletedTour.id,
            details: {
              tour_name: deletedTour.name,
              deleted_by_realtime: true
            }
          });

          if (usersToNotify) {
            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Tour Deleted",
                message: `Tour "${deletedTour.name}" has been deleted.`,
                type: 'tour',
                priority: 'high',
                related_id: deletedTour.id,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up tours real-time subscriptions...');
      supabase.removeChannel(toursChannel);
    };
  }, [queryClient, userId, logOperation]);
};
