
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification } from "@/utils/notificationHelpers";

export const useToursRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (!userId) return;

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
          
          const newTour = payload.new as any;
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

          await createNotification(userId, {
            title: "New Tour Created",
            message: `Tour "${newTour.name}" has been created`,
            type: 'tour',
            priority: 'medium',
            related_id: newTour.id,
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
          
          const oldTour = payload.old as any;
          const newTour = payload.new as any;
          
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
            await createNotification(userId, {
              title: "Tour Dates Updated",
              message: `${newTour.name} dates changed - tasks regenerated`,
              type: 'tour',
              priority: 'high',
              related_id: newTour.id,
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

          const deletedTour = payload.old as any;
          logOperation({
            operation_type: 'DELETE',
            table_name: 'tours',
            record_id: deletedTour.id,
            details: {
              tour_name: deletedTour.name,
              deleted_by_realtime: true
            }
          });

          await createNotification(userId, {
            title: "Tour Deleted",
            message: `Tour "${deletedTour.name}" has been deleted.`,
            type: 'tour',
            priority: 'high',
            related_id: deletedTour.id,
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
