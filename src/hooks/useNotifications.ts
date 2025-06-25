
import { useState } from "react";
import { Database } from "@/integrations/supabase/types";
import { useNotificationQuery } from "@/hooks/useNotificationQuery";
import { useNotificationMutations } from "@/hooks/useNotificationMutations";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

export const useNotifications = (limit: number = 10) => {
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  
  const { data: notifications = [], isLoading, refetch } = useNotificationQuery(limit);
  const { markAsReadMutation, deleteNotificationMutation, bulkDeleteMutation } = useNotificationMutations();

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
      bulkDeleteMutation.mutate(selectedNotifications, {
        onSuccess: () => {
          setSelectedNotifications([]);
        }
      });
    }
  };

  const handleSingleDelete = (notificationId: string) => {
    console.log('Single delete button clicked for notification:', notificationId);
    deleteNotificationMutation.mutate(notificationId, {
      onSuccess: () => {
        setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
      }
    });
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
    refetch,
  };
};
