
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification, getTourNameById } from "@/utils/notificationHelpers";

export const useToursRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useToursRealtime');
      return;
    }

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      console.log('Tours realtime already subscribed, skipping...');
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

          console.log('Creating tour creation notification');
          
          // Create only ONE notification for tour creation
          await createNotification(userId, {
            title: "New Tour Created",
            message: `Tour "${newTour.name}" has been created`,
            type: 'tour',
            priority: 'medium',
            related_id: newTour.id,
            department: 'operations',
          });

          logOperation({
            operation_type: 'CREATE',
            table_name: 'tours',
            record_id: newTour.id,
            details: {
              tour_name: newTour.name,
              start_date: newTour.start_date,
              end_date: newTour.end_date,
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

          // Skip notifications for automatic capacity updates (these are triggered by booking changes)
          const isCapacityOnlyUpdate = (
            oldTour.capacity !== newTour.capacity &&
            oldTour.name === newTour.name &&
            oldTour.start_date === newTour.start_date &&
            oldTour.end_date === newTour.end_date &&
            oldTour.status === newTour.status
          );

          if (isCapacityOnlyUpdate) {
            console.log('Skipping notification for automatic capacity update');
            return;
          }

          console.log('Creating tour update notification for manual changes');

          // Create only ONE notification for tour updates (not automatic capacity changes)
          await createNotification(userId, {
            title: "Tour Updated",
            message: `Tour "${newTour.name}" has been updated`,
            type: 'tour',
            priority: 'medium',
            related_id: newTour.id,
            department: 'operations',
          });

          logOperation({
            operation_type: 'UPDATE',
            table_name: 'tours',
            record_id: newTour.id,
            details: {
              tour_name: newTour.name,
              updated_by_realtime: true
            }
          });
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

          console.log('Creating tour deletion notification');

          // Create only ONE notification for tour deletion
          await createNotification(userId, {
            title: "Tour Deleted",
            message: `Tour "${deletedTour.name}" has been deleted`,
            type: 'tour',
            priority: 'high',
            related_id: deletedTour.id,
            department: 'operations',
          });
        }
      )
      .subscribe();

    channelRef.current = toursChannel;

    return () => {
      console.log('Cleaning up tours real-time subscriptions...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, userId, logOperation]);
};
