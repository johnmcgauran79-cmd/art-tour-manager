
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { NotificationIcon } from "./NotificationIcon";
import { Database } from "@/integrations/supabase/types";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

interface NotificationItemProps {
  notification: Notification;
  isSelected: boolean;
  onCheckboxChange: (notificationId: string, checked: boolean) => void;
  onNotificationClick: (notification: Notification) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'border-l-red-500';
    case 'high': return 'border-l-orange-500';
    case 'medium': return 'border-l-yellow-500';
    case 'low': return 'border-l-blue-500';
    default: return 'border-l-gray-500';
  }
};

export const NotificationItem = ({ 
  notification, 
  isSelected, 
  onCheckboxChange, 
  onNotificationClick 
}: NotificationItemProps) => {
  const handleNotificationClick = async () => {
    console.log('Notification clicked:', notification);
    
    if (notification.related_id) {
      // Handle different notification types with proper navigation
      if (notification.type === 'booking') {
        console.log('Dispatching booking detail event for:', notification.related_id);
        window.dispatchEvent(new CustomEvent('open-booking-detail', { 
          detail: { 
            bookingId: notification.related_id,
            hotelId: notification.message.includes('hotel') ? 'auto-navigate' : undefined
          } 
        }));
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
            }
          } catch (error) {
            console.error('Error finding booking for dietary update:', error);
          }
        }
      }
    }
    
    // Trigger the click handler from parent
    onNotificationClick(notification);
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 border-l-2 ${getPriorityColor(notification.priority)} bg-gray-50/50 hover:bg-gray-100/50 rounded-r transition-colors cursor-pointer`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => 
          onCheckboxChange(notification.id, checked as boolean)
        }
        className="h-3 w-3"
      />
      <div className="flex-shrink-0">
        <NotificationIcon type={notification.type} priority={notification.priority} />
      </div>
      <div 
        className="flex-1 min-w-0 flex items-center justify-between"
        onClick={handleNotificationClick}
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
  );
};
