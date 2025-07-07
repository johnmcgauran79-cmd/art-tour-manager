
import { useState } from "react";
import { Database } from "@/integrations/supabase/types";
import { useNotificationQuery } from "@/hooks/useNotificationQuery";
import { useNotificationMutations } from "@/hooks/useNotificationMutations";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

export const useNotifications = (limit: number = 10) => {
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  
  const { data, isLoading, refetch } = useNotificationQuery(limit);
  const notifications = data?.notifications || [];
  const totalUnreadCount = data?.totalUnreadCount || 0;
  
  const { markAsReadMutation, deleteNotificationMutation, bulkDeleteMutation } = useNotificationMutations();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleCheckboxChange = (notificationId: string, checked: boolean) => {
    setSelectedNotifications(prev => {
      return checked 
        ? [...prev, notificationId]
        : prev.filter(id => id !== notificationId);
    });
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length > 0) {
      try {
        await bulkDeleteMutation.mutateAsync(selectedNotifications);
        setSelectedNotifications([]);
      } catch (error) {
        console.error('Bulk delete failed:', error);
      }
    }
  };

  const handleSingleDelete = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId, {
      onSuccess: () => {
        setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
      }
    });
  };

  return {
    notifications,
    isLoading,
    selectedNotifications,
    unreadCount: totalUnreadCount,
    handleNotificationClick,
    handleCheckboxChange,
    handleBulkDelete,
    handleSingleDelete,
    isDeleting: bulkDeleteMutation.isPending || deleteNotificationMutation.isPending,
    refetch,
  };
};
