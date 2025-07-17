
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification } from "@/utils/notificationHelpers";

export const useActivitiesRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useActivitiesRealtime');
      return;
    }

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      console.log('Activities realtime already subscribed, skipping...');
      return;
    }

    console.log('Setting up activities realtime subscription for user:', userId);

    const channelName = `activities-realtime-${userId}-${Date.now()}`;
    const activitiesChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities'
        },
        async (payload) => {
          console.log('New activity created:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          const newActivity = payload.new as any;
          
          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';
          
          // Notify both operations and booking departments
          await createNotification('', {
            title: "New Activity Added",
            message: `Activity "${newActivity.name}" has been added by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newActivity.id,
            department: 'operations',
          });
          
          await createNotification('', {
            title: "New Activity Added",
            message: `Activity "${newActivity.name}" has been added by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newActivity.id,
            department: 'booking',
          });

          logOperation({
            operation_type: 'CREATE',
            table_name: 'activities',
            record_id: newActivity.id,
            details: {
              activity_name: newActivity.name,
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
          table: 'activities'
        },
        async (payload) => {
          console.log('Activity updated:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          const oldActivity = payload.old as any;
          const newActivity = payload.new as any;
          
          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';
          
          // Notify both operations and booking departments
          await createNotification('', {
            title: "Activity Updated",
            message: `Activity "${newActivity.name}" has been updated by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newActivity.id,
            department: 'operations',
          });
          
          await createNotification('', {
            title: "Activity Updated",
            message: `Activity "${newActivity.name}" has been updated by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newActivity.id,
            department: 'booking',
          });

          logOperation({
            operation_type: 'UPDATE',
            table_name: 'activities',
            record_id: newActivity.id,
            details: {
              activity_name: newActivity.name,
              updated_by_realtime: true
            }
          });

          // Check for capacity issues - separate notification for overselling
          if (newActivity.spots_booked > newActivity.spots_available && 
              oldActivity.spots_booked <= oldActivity.spots_available) {
            await createNotification('', {
              title: "Activity Oversold Alert",
              message: `Activity "${newActivity.name}" is oversold: ${newActivity.spots_booked} booked vs ${newActivity.spots_available} available`,
              type: 'system',
              priority: 'high',
              related_id: newActivity.id,
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
          table: 'activities'
        },
        async (payload) => {
          console.log('Activity deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedActivity = payload.old as any;
          
          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';
          
          // Notify both operations and booking departments
          await createNotification('', {
            title: "Activity Deleted",
            message: `Activity "${deletedActivity.name}" has been deleted by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: deletedActivity.id,
            department: 'operations',
          });
          
          await createNotification('', {
            title: "Activity Deleted",
            message: `Activity "${deletedActivity.name}" has been deleted by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: deletedActivity.id,
            department: 'booking',
          });

          logOperation({
            operation_type: 'DELETE',
            table_name: 'activities',
            record_id: deletedActivity.id,
            details: {
              activity_name: deletedActivity.name,
              deleted_by_realtime: true
            }
          });
        }
      )
      .subscribe();

    channelRef.current = activitiesChannel;

    return () => {
      console.log('Cleaning up activities real-time subscriptions...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, userId, logOperation]);
};
