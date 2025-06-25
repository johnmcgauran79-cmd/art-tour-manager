
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationItem } from "@/components/NotificationItem";
import { Database } from "@/integrations/supabase/types";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

interface NotificationListProps {
  notifications: Notification[];
  selectedNotifications: string[];
  onCheckboxChange: (notificationId: string, checked: boolean) => void;
  onNotificationClick: (notification: Notification) => void;
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
  onDelete: (notificationId: string) => void;
  maxHeight?: string;
}

export const NotificationList = ({
  notifications,
  selectedNotifications,
  onCheckboxChange,
  onNotificationClick,
  onNavigateToItem,
  onDelete,
  maxHeight = "400px"
}: NotificationListProps) => {
  return (
    <ScrollArea className="w-full" style={{ height: maxHeight }}>
      <div className="space-y-1 pr-4">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            isSelected={selectedNotifications.includes(notification.id)}
            onCheckboxChange={onCheckboxChange}
            onNotificationClick={onNotificationClick}
            onNavigateToItem={onNavigateToItem}
            onDelete={onDelete}
          />
        ))}
      </div>
    </ScrollArea>
  );
};
