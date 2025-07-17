
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification } from "@/utils/notificationHelpers";

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

          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';

          console.log('Creating tour creation notification');
          
          await createNotification('', {
            title: "New Tour Created",
            message: `Tour "${newTour.name}" has been created by ${userName}`,
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

          // Skip notifications for automatic capacity updates caused by booking changes
          const isCapacityOnlyUpdate = (
            oldTour.capacity !== newTour.capacity &&
            oldTour.name === newTour.name &&
            oldTour.start_date === newTour.start_date &&
            oldTour.end_date === newTour.end_date &&
            oldTour.status === newTour.status &&
            oldTour.updated_at !== newTour.updated_at
          );

          if (isCapacityOnlyUpdate) {
            console.log('Skipping notification for automatic capacity update - this was triggered by booking changes');
            return;
          }

          // Only notify for manual tour updates (not automatic booking-related changes)
          const hasSignificantChange = (
            oldTour.name !== newTour.name ||
            oldTour.start_date !== newTour.start_date ||
            oldTour.end_date !== newTour.end_date ||
            oldTour.status !== newTour.status ||
            oldTour.location !== newTour.location ||
            oldTour.tour_host !== newTour.tour_host
          );

          if (hasSignificantChange) {
            console.log('Tour update detected - notifications will be handled by useTours hook mutation');

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

          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';

          console.log('Creating tour deletion notification');

          await createNotification('', {
            title: "Tour Deleted",
            message: `Tour "${deletedTour.name}" has been deleted by ${userName}`,
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
