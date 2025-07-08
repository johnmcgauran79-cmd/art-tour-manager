
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export const useNotificationMutations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  const dismissNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_notification_dismissals')
        .upsert({
          user_id: user.id,
          notification_id: notificationId
        }, {
          onConflict: 'user_id,notification_id'
        });

      if (error) throw error;
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Removed the success toast notification
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss notification",
        variant: "destructive",
      });
    },
  });

  const bulkDismissMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!user?.id) throw new Error('User not authenticated');

      const dismissalRecords = notificationIds.map(notificationId => ({
        user_id: user.id,
        notification_id: notificationId
      }));

      const { error } = await supabase
        .from('user_notification_dismissals')
        .upsert(dismissalRecords, {
          onConflict: 'user_id,notification_id'
        });

      if (error) throw error;
      return notificationIds;
    },
    onSuccess: (dismissedIds) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Removed the success toast notification for bulk dismiss as well
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss notifications",
        variant: "destructive",
      });
    },
  });

  return {
    markAsReadMutation,
    deleteNotificationMutation: dismissNotificationMutation,
    bulkDeleteMutation: bulkDismissMutation,
  };
};
