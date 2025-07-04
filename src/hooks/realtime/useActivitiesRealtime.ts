
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification, getActivityNameById, getTourNameById } from "@/utils/notificationHelpers";

export const useActivitiesRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useActivitiesRealtime');
      return;
    }

    console.log('Setting up activities realtime subscription for user:', userId);

    // Create a unique channel name for activities
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
          
          // Get all users with relevant roles to notify - booking agents, managers and admins
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager', 'booking_agent']);

          console.log('Notifying users about new activity:', usersToNotify?.length || 0, 'users');

          const activityName = newActivity.name;
          const tourName = newActivity.tour_id ? await getTourNameById(newActivity.tour_id) : null;

          logOperation({
            operation_type: 'CREATE',
            table_name: 'activities',
            record_id: newActivity.id,
            details: {
              activity_name: activityName,
              tour_name: tourName,
              created_by_realtime: true
            }
          });

          if (usersToNotify) {
            const message = tourName 
              ? `New activity "${activityName}" created for ${tourName}`
              : `New activity "${activityName}" created`;

            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "New Activity Created",
                message: message,
                type: 'system',
                priority: 'medium',
                related_id: newActivity.id,
              });
            }
          }
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
          
          // Get all users with relevant roles to notify - booking agents, managers and admins  
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager', 'booking_agent']);

          console.log('Notifying users about activity update:', usersToNotify?.length || 0, 'users');

          const activityName = newActivity.name;
          const tourName = newActivity.tour_id ? await getTourNameById(newActivity.tour_id) : null;

          logOperation({
            operation_type: 'UPDATE',
            table_name: 'activities',
            record_id: newActivity.id,
            details: {
              activity_name: activityName,
              tour_name: tourName,
              updated_by_realtime: true
            }
          });

          // Notify about status changes
          if (oldActivity.activity_status !== newActivity.activity_status && usersToNotify) {
            const message = tourName 
              ? `Activity "${activityName}" for ${tourName} status changed to ${newActivity.activity_status}`
              : `Activity "${activityName}" status changed to ${newActivity.activity_status}`;

            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Activity Status Updated",
                message: message,
                type: 'system',
                priority: 'medium',
                related_id: newActivity.id,
              });
            }
          }

          // Notify about date changes
          if (oldActivity.activity_date !== newActivity.activity_date && usersToNotify) {
            const message = tourName 
              ? `Activity "${activityName}" for ${tourName} date has been updated`
              : `Activity "${activityName}" date has been updated`;

            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Activity Date Updated",
                message: message,
                type: 'system',
                priority: 'high',
                related_id: newActivity.id,
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
          table: 'activities'
        },
        async (payload) => {
          console.log('Activity deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedActivity = payload.old as any;
          
          // Get all users with relevant roles to notify - booking agents, managers and admins
          const { data: usersToNotify } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager', 'booking_agent']);

          console.log('Notifying users about activity deletion:', usersToNotify?.length || 0, 'users');

          const activityName = deletedActivity.name;
          const tourName = deletedActivity.tour_id ? await getTourNameById(deletedActivity.tour_id) : null;

          logOperation({
            operation_type: 'DELETE',
            table_name: 'activities',
            record_id: deletedActivity.id,
            details: {
              activity_name: activityName,
              tour_name: tourName,
              deleted_by_realtime: true
            }
          });

          if (usersToNotify) {
            const message = tourName 
              ? `Activity "${activityName}" for ${tourName} has been deleted`
              : `Activity "${activityName}" has been deleted`;

            for (const user of usersToNotify) {
              await createNotification(user.user_id, {
                title: "Activity Deleted",
                message: message,
                type: 'system',
                priority: 'medium',
                related_id: deletedActivity.id,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up activities real-time subscriptions...');
      supabase.removeChannel(activitiesChannel);
    };
  }, [queryClient, userId, logOperation]);
};
