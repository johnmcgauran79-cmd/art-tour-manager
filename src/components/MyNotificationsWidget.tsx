
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationItem } from "@/components/NotificationItem";
import { NotificationActions } from "@/components/NotificationActions";
import { Bell, Trash2, CheckCircle } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

interface MyNotificationsWidgetProps {
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
}

export const MyNotificationsWidget = ({ onNavigateToItem }: MyNotificationsWidgetProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
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
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .in('id', notificationIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedNotifications([]);
      toast({
        title: "Success",
        description: `${selectedNotifications.length} notifications deleted`,
      });
    },
    onError: (error) => {
      console.error('Error deleting notifications:', error);
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
    if (checked) {
      setSelectedNotifications(prev => [...prev, notificationId]);
    } else {
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
    }
  };

  const handleBulkDelete = () => {
    if (selectedNotifications.length > 0) {
      bulkDeleteMutation.mutate(selectedNotifications);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy">Recent Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <NotificationActions 
            selectedCount={selectedNotifications.length}
            totalCount={notifications.length}
            onBulkDelete={handleBulkDelete}
            isLoading={bulkDeleteMutation.isPending}
            mode="delete"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  isSelected={selectedNotifications.includes(notification.id)}
                  onCheckboxChange={handleCheckboxChange}
                  onNotificationClick={handleNotificationClick}
                  onNavigateToItem={onNavigateToItem}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
