
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
        .eq('user_id', user.id)
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

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      console.log('Starting delete for notification:', notificationId);
      
      if (!user?.id) {
        console.error('No user ID available for delete');
        throw new Error('User not authenticated');
      }

      console.log('Executing delete query for notification:', notificationId);
      
      const { data, error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('Delete query failed:', error);
        throw error;
      }
      
      console.log('Delete query successful, deleted data:', data);
      return { notificationId, deletedData: data };
    },
    onSuccess: ({ notificationId }) => {
      console.log('Delete mutation success callback - notification:', notificationId);
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    },
    onError: (error) => {
      console.error('Delete mutation error:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      console.log('Bulk deleting notifications:', notificationIds);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // First, let's check what notifications exist before deletion
      const { data: beforeDelete } = await supabase
        .from('user_notifications')
        .select('id')
        .in('id', notificationIds)
        .eq('user_id', user.id);
      
      console.log('Notifications found before delete:', beforeDelete?.length || 0);

      const { data, error } = await supabase
        .from('user_notifications')
        .delete()
        .in('id', notificationIds)
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('Error bulk deleting notifications:', error);
        throw error;
      }
      
      console.log('Successfully bulk deleted notifications count:', data?.length || 0);
      console.log('Bulk deleted notification IDs:', data?.map(n => n.id) || []);
      return notificationIds;
    },
    onSuccess: (deletedIds) => {
      console.log('Bulk delete success, invalidating queries for user:', user?.id);
      const deletedCount = deletedIds.length;
      
      // Force refetch of notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications', user?.id] });
      
      toast({
        title: "Success",
        description: `${deletedCount} notifications deleted`,
      });
    },
    onError: (error) => {
      console.error('Error bulk deleting notifications:', error);
      toast({
        title: "Error",
        description: "Failed to delete notifications",
        variant: "destructive",
      });
    },
  });

  return {
    markAsReadMutation,
    deleteNotificationMutation,
    bulkDeleteMutation,
  };
};
