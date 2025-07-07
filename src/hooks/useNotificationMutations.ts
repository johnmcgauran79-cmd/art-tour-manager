
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export const useNotificationMutations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      console.log('Marking notification as read:', notificationId);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .select();

      if (error) {
        console.error('Error marking notification as read:', error);
        throw error;
      }
      
      console.log('Successfully marked notification as read:', data);
      return data;
    },
    onSuccess: () => {
      console.log('Mark as read success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    onError: (error) => {
      console.error('Error marking notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Dismiss notification mutation (replaces delete)
  const dismissNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      console.log('Dismissing notification:', notificationId);
      
      if (!user?.id) {
        console.error('No user ID available for dismiss');
        throw new Error('User not authenticated');
      }

      console.log('Creating dismissal record for notification:', notificationId);
      
      const { data, error } = await supabase
        .from('user_notification_dismissals')
        .upsert({
          user_id: user.id,
          notification_id: notificationId
        }, {
          onConflict: 'user_id,notification_id'
        })
        .select();

      if (error) {
        console.error('Dismiss query failed:', error);
        throw error;
      }
      
      console.log('Dismiss query successful, dismissal data:', data);
      return { notificationId, dismissalData: data };
    },
    onSuccess: ({ notificationId }) => {
      console.log('Dismiss mutation success callback - notification:', notificationId);
      
      // Immediately invalidate and refetch queries to update UI
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications', user?.id] });
      
      toast({
        title: "Success",
        description: "Notification dismissed",
      });
    },
    onError: (error) => {
      console.error('Dismiss mutation error:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss notification",
        variant: "destructive",
      });
    },
  });

  // Bulk dismiss mutation (replaces bulk delete)
  const bulkDismissMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      console.log('Bulk dismissing notifications:', notificationIds);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Create dismissal records for all selected notifications using upsert
      const dismissalRecords = notificationIds.map(notificationId => ({
        user_id: user.id,
        notification_id: notificationId
      }));

      console.log('Creating dismissal records for:', dismissalRecords.length, 'notifications');

      const { data, error } = await supabase
        .from('user_notification_dismissals')
        .upsert(dismissalRecords, {
          onConflict: 'user_id,notification_id'
        })
        .select();

      if (error) {
        console.error('Error bulk dismissing notifications:', error);
        throw error;
      }
      
      console.log('Successfully bulk dismissed notifications count:', data?.length || 0);
      console.log('Bulk dismissed notification IDs:', notificationIds);
      return notificationIds;
    },
    onSuccess: (dismissedIds) => {
      console.log('Bulk dismiss success, invalidating queries for user:', user?.id);
      const dismissedCount = dismissedIds.length;
      
      // Force immediate refetch of notifications to update UI
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications', user?.id] });
      
      toast({
        title: "Success",
        description: `${dismissedCount} notifications dismissed`,
      });
    },
    onError: (error) => {
      console.error('Error bulk dismissing notifications:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss notifications",
        variant: "destructive",
      });
    },
  });

  return {
    markAsReadMutation,
    deleteNotificationMutation: dismissNotificationMutation, // Keep same interface
    bulkDeleteMutation: bulkDismissMutation, // Keep same interface
  };
};
