
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Check, X, Calendar, Users, FileText, Settings, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

const getNotificationIcon = (type: string, priority: string) => {
  const className = `h-4 w-4 ${
    priority === 'critical' ? 'text-red-600' : 
    priority === 'high' ? 'text-orange-600' : 
    priority === 'medium' ? 'text-yellow-600' : 
    'text-blue-600'
  }`;

  switch (type) {
    case 'task': return <Settings className={className} />;
    case 'tour': return <Calendar className={className} />;
    case 'booking': return <FileText className={className} />;
    case 'system': return <Info className={className} />;
    default: return <Bell className={className} />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'bg-red-100 border-red-200 hover:bg-red-50';
    case 'high': return 'bg-orange-100 border-orange-200 hover:bg-orange-50';
    case 'medium': return 'bg-yellow-100 border-yellow-200 hover:bg-yellow-50';
    case 'low': return 'bg-blue-100 border-blue-200 hover:bg-blue-50';
    default: return 'bg-gray-100 border-gray-200 hover:bg-gray-50';
  }
};

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

  // Handle notification click to navigate to related item
  const handleNotificationClick = (notification: Notification) => {
    if (notification.related_id && onNavigateToItem) {
      onNavigateToItem(notification.type, notification.related_id);
    }
    
    // Mark as read when clicked
    acknowledgeMutation.mutate([notification.id]);
  };

  // Handle checkbox selection
  const handleCheckboxChange = (notificationId: string, checked: boolean) => {
    if (checked) {
      setSelectedNotifications(prev => [...prev, notificationId]);
    } else {
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
    }
  };

  // Handle bulk acknowledge
  const handleBulkAcknowledge = () => {
    if (selectedNotifications.length > 0) {
      acknowledgeMutation.mutate(selectedNotifications);
    }
  };

  // Handle acknowledge all
  const handleAcknowledgeAll = () => {
    const allIds = notifications.map(n => n.id);
    acknowledgeMutation.mutate(allIds);
  };

  if (isLoading) {
    return (
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-brand-navy">
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy">My Notifications</CardTitle>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                {notifications.length} new
              </Badge>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              {selectedNotifications.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBulkAcknowledge}
                  disabled={acknowledgeMutation.isPending}
                  className="h-8"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Acknowledge Selected
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleAcknowledgeAll}
                disabled={acknowledgeMutation.isPending}
                className="h-8"
              >
                Acknowledge All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No new notifications</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border rounded-lg transition-colors cursor-pointer ${getPriorityColor(notification.priority)}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedNotifications.includes(notification.id)}
                    onCheckedChange={(checked) => 
                      handleCheckboxChange(notification.id, checked as boolean)
                    }
                    className="mt-1"
                  />
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>
                  <div 
                    className="flex-1 min-w-0"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm leading-tight">
                        {notification.title}
                      </p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          notification.priority === 'critical' ? 'border-red-500 text-red-700' :
                          notification.priority === 'high' ? 'border-orange-500 text-orange-700' :
                          notification.priority === 'medium' ? 'border-yellow-500 text-yellow-700' :
                          'border-blue-500 text-blue-700'
                        }`}
                      >
                        {notification.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {notification.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
