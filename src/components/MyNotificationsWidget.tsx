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
  const className = `h-3 w-3 ${
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
    case 'critical': return 'border-l-red-500';
    case 'high': return 'border-l-orange-500';
    case 'medium': return 'border-l-yellow-500';
    case 'low': return 'border-l-blue-500';
    default: return 'border-l-gray-500';
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
  const handleNotificationClick = async (notification: Notification) => {
    console.log('Notification clicked:', notification);
    
    if (notification.related_id) {
      // Handle different notification types with proper navigation
      if (notification.type === 'booking') {
        console.log('Dispatching booking detail event for:', notification.related_id);
        // For booking notifications, open the specific booking
        window.dispatchEvent(new CustomEvent('open-booking-detail', { 
          detail: { 
            bookingId: notification.related_id,
            hotelId: notification.message.includes('hotel') ? 'auto-navigate' : undefined
          } 
        }));
      } else if (notification.type === 'tour') {
        // For tour notifications, navigate to tours tab and highlight
        if (onNavigateToItem) {
          onNavigateToItem(notification.type, notification.related_id);
        }
      } else if (notification.type === 'task') {
        // For task notifications, navigate to operations tab and highlight
        if (onNavigateToItem) {
          onNavigateToItem(notification.type, notification.related_id);
        }
      } else if (notification.type === 'system') {
        // For system notifications, check if it's a dietary update
        if (notification.message.includes('Dietary requirements')) {
          // Find the booking for this customer and open it
          try {
            const { data: bookings } = await supabase
              .from('bookings')
              .select('id')
              .eq('lead_passenger_id', notification.related_id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (bookings && bookings.length > 0) {
              console.log('Opening booking for dietary update:', bookings[0].id);
              window.dispatchEvent(new CustomEvent('open-booking-detail', { 
                detail: { 
                  bookingId: bookings[0].id
                } 
              }));
            } else {
              // Fallback to contacts if no booking found
              if (onNavigateToItem) {
                onNavigateToItem(notification.type, notification.related_id);
              }
            }
          } catch (error) {
            console.error('Error finding booking for dietary update:', error);
            // Fallback to contacts
            if (onNavigateToItem) {
              onNavigateToItem(notification.type, notification.related_id);
            }
          }
        } else {
          // For other system notifications (like contact updates), go to contacts
          if (onNavigateToItem) {
            onNavigateToItem(notification.type, notification.related_id);
          }
        }
      }
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
          {notifications.length > 0 && (
            <div className="flex gap-2">
              {selectedNotifications.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBulkAcknowledge}
                  disabled={acknowledgeMutation.isPending}
                  className="h-7 text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Acknowledge ({selectedNotifications.length})
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleAcknowledgeAll}
                disabled={acknowledgeMutation.isPending}
                className="h-7 text-xs"
              >
                Clear All
              </Button>
            </div>
          )}
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
              <div
                key={notification.id}
                className={`flex items-center gap-2 p-2 border-l-2 ${getPriorityColor(notification.priority)} bg-gray-50/50 hover:bg-gray-100/50 rounded-r transition-colors cursor-pointer`}
              >
                <Checkbox
                  checked={selectedNotifications.includes(notification.id)}
                  onCheckedChange={(checked) => 
                    handleCheckboxChange(notification.id, checked as boolean)
                  }
                  className="h-3 w-3"
                />
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type, notification.priority)}
                </div>
                <div 
                  className="flex-1 min-w-0 flex items-center justify-between"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-xs truncate">
                      {notification.title}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      - {notification.message}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-1 py-0 h-4 ${
                        notification.priority === 'critical' ? 'border-red-500 text-red-700' :
                        notification.priority === 'high' ? 'border-orange-500 text-orange-700' :
                        notification.priority === 'medium' ? 'border-yellow-500 text-yellow-700' :
                        'border-blue-500 text-blue-700'
                      }`}
                    >
                      {notification.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
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
