
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "@/integrations/supabase/types";
import { NotificationItem } from "./NotificationItem";
import { NotificationActions } from "./NotificationActions";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

interface MyNotificationsWidgetProps {
  onNavigateToItem?: (type: string, itemId: string) => void;
}

export const MyNotificationsWidget = ({ onNavigateToItem }: MyNotificationsWidgetProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Acknowledge notifications mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const { error } = await supabase
        .from('user_notifications')
        .update({ acknowledged: true, read: true })
        .in('id', notificationIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedNotifications([]);
    },
  });

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read when clicked
    acknowledgeMutation.mutate([notification.id]);
  };

  const handleCheckboxChange = (notificationId: string, checked: boolean) => {
    if (checked) {
      setSelectedNotifications(prev => [...prev, notificationId]);
    } else {
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
    }
  };

  const handleBulkAcknowledge = () => {
    if (selectedNotifications.length > 0) {
      acknowledgeMutation.mutate(selectedNotifications);
    }
  };

  const handleAcknowledgeAll = () => {
    const allIds = notifications.map(n => n.id);
    acknowledgeMutation.mutate(allIds);
  };

  if (isLoading) {
    return (
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-brand-navy text-lg">
            <Bell className="h-5 w-5" />
            My Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading notifications...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy text-lg">My Notifications</CardTitle>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy text-xs">
                {notifications.length}
              </Badge>
            )}
          </div>
          <NotificationActions
            selectedCount={selectedNotifications.length}
            totalCount={notifications.length}
            isLoading={acknowledgeMutation.isPending}
            onBulkAcknowledge={handleBulkAcknowledge}
            onAcknowledgeAll={handleAcknowledgeAll}
          />
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {notifications.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No new notifications</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isSelected={selectedNotifications.includes(notification.id)}
                onCheckboxChange={handleCheckboxChange}
                onNotificationClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
