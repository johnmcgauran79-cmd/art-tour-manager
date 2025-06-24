
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  // Fetch notifications
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!user?.id) return [];
      
      console.log('Fetching notifications for user:', user.id);
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
      console.log('Fetched notifications:', data);
      return data || [];
    },
    enabled: !!user?.id,
  });

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
    onSuccess: ({ notificationId, deletedData }) => {
      console.log('Delete mutation success callback - notification:', notificationId, 'deleted:', deletedData);
      
      setSelectedNotifications(prev => {
        const updated = prev.filter(id => id !== notificationId);
        console.log('Updated selected notifications:', updated);
        return updated;
      });
      
      console.log('Forcing refetch after delete');
      refetch().then((result) => {
        console.log('Refetch completed after delete:', result.data?.length, 'notifications');
      });
      
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

      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .in('id', notificationIds)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error bulk deleting notifications:', error);
        throw error;
      }
      
      console.log('Successfully bulk deleted notifications:', notificationIds);
      return notificationIds;
    },
    onSuccess: (deletedIds) => {
      console.log('Bulk delete success, clearing selection and updating UI');
      const deletedCount = deletedIds.length;
      setSelectedNotifications([]);
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
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

  const handleNotificationClick = (notification: Notification) => {
    console.log('Notification clicked, marking as read:', notification.id);
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleCheckboxChange = (notificationId: string, checked: boolean) => {
    console.log('Checkbox changed:', notificationId, checked);
    if (checked) {
      setSelectedNotifications(prev => [...prev, notificationId]);
    } else {
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
    }
  };

  const handleBulkDelete = () => {
    console.log('Bulk delete requested for:', selectedNotifications);
    if (selectedNotifications.length > 0) {
      bulkDeleteMutation.mutate(selectedNotifications);
    }
  };

  const handleSingleDelete = (notificationId: string) => {
    console.log('Single delete button clicked for notification:', notificationId);
    deleteNotificationMutation.mutate(notificationId);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    isLoading,
    selectedNotifications,
    unreadCount,
    handleNotificationClick,
    handleCheckboxChange,
    handleBulkDelete,
    handleSingleDelete,
    isDeleting: bulkDeleteMutation.isPending || deleteNotificationMutation.isPending,
  };
};
