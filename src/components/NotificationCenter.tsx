
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationIcon } from "@/components/NotificationIcon";

export const NotificationCenter = () => {
  const { user } = useAuth();
  const { data: userDepartments = [] } = useUserDepartments();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const {
    notifications,
    isLoading,
    unreadCount,
    refetch
  } = useNotifications(50);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      console.log('NotificationCenter: Marking notification as read:', notificationId);
      
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
        console.error('NotificationCenter: Error marking notification as read:', error);
        throw error;
      }
      
      console.log('NotificationCenter: Successfully marked as read:', data);
      return data;
    },
    onSuccess: () => {
      console.log('NotificationCenter: Mark as read success, refetching');
      refetch();
    },
    onError: (error) => {
      console.error('NotificationCenter: Error marking notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Acknowledge notification mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      console.log('NotificationCenter: Acknowledging notification:', notificationId);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('user_notifications')
        .update({ acknowledged: true, read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('NotificationCenter: Error acknowledging notification:', error);
        throw error;
      }
      
      console.log('NotificationCenter: Successfully acknowledged:', data);
      return data;
    },
    onSuccess: () => {
      console.log('NotificationCenter: Acknowledge success, refetching');
      refetch();
      toast({
        title: "Success",
        description: "Notification acknowledged",
      });
    },
    onError: (error) => {
      console.error('NotificationCenter: Error acknowledging notification:', error);
      toast({
        title: "Error",
        description: "Failed to acknowledge notification",
        variant: "destructive",
      });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      console.log('NotificationCenter: Marking all notifications as read for user:', user.id);
      
      let baseCondition = `user_id.eq.${user.id}`;
      if (userDepartments.length > 0) {
        baseCondition = `user_id.eq.${user.id},department.in.(${userDepartments.join(',')})`;
      }

      const { data, error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .or(baseCondition)
        .eq('read', false)
        .select();

      if (error) {
        console.error('NotificationCenter: Error marking all as read:', error);
        throw error;
      }
      
      console.log('NotificationCenter: Successfully marked all as read:', data);
      return data;
    },
    onSuccess: () => {
      console.log('NotificationCenter: Mark all as read success, refetching');
      refetch();
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error) => {
      console.error('NotificationCenter: Error marking all as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  // Auto-mark unread notifications as read when notification center is opened
  useEffect(() => {
    if (open && notifications.length > 0) {
      const unreadNotifications = notifications.filter(n => !n.read);
      console.log('NotificationCenter: Auto-marking unread notifications as read:', unreadNotifications.length);
      unreadNotifications.forEach(notification => {
        markAsReadMutation.mutate(notification.id);
      });
    }
  }, [open, notifications.length]);

  const unacknowledgedCount = notifications.filter(n => !n.acknowledged).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-primary-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  Mark all read
                </Button>
              )}
            </div>
            {unacknowledgedCount > 0 && (
              <Badge variant="outline" className="w-fit">
                {unacknowledgedCount} require acknowledgment
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-border/50 hover:bg-accent/50 transition-colors ${
                        !notification.read ? 'bg-blue-50/50' : ''
                      } ${
                        !notification.acknowledged ? 'border-l-4 border-l-orange-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <NotificationIcon type={notification.type} priority={notification.priority} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-tight">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </span>
                            {!notification.acknowledged && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={() => acknowledgeMutation.mutate(notification.id)}
                                disabled={acknowledgeMutation.isPending}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
