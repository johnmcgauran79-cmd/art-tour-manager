
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { NotificationIcon } from "./NotificationIcon";
import { Database } from "@/integrations/supabase/types";
import { Trash2 } from "lucide-react";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

interface NotificationItemProps {
  notification: Notification;
  isSelected: boolean;
  onCheckboxChange: (notificationId: string, checked: boolean) => void;
  onNotificationClick: (notification: Notification) => void;
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
  onDelete?: (notificationId: string) => void;
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
  onNotificationClick,
  onNavigateToItem,
  onDelete
}: NotificationItemProps) => {
  const handleNotificationClick = async (e: React.MouseEvent) => {
    // Don't trigger if clicking on checkbox or delete button
    if ((e.target as HTMLElement).closest('button, [data-checkbox]')) {
      return;
    }

    console.log('Notification clicked:', notification);
    
    // Call the parent's click handler first (this will mark as read)
    onNotificationClick(notification);
    
    // Handle navigation based on notification type and content
    if (notification.related_id && onNavigateToItem) {
      // Check if this is an activity-related notification
      if (notification.type === 'booking' && 
          (notification.message.includes('activity') || 
           notification.message.includes('Activity') ||
           notification.message.includes('attendance'))) {
        console.log('Activity notification - finding tour for booking:', notification.related_id);
        
        // Get the booking to find the associated tour
        try {
          const { data: booking } = await supabase
            .from('bookings')
            .select('tour_id')
            .eq('id', notification.related_id)
            .single();

          if (booking?.tour_id) {
            console.log('Opening activities tab for tour:', booking.tour_id);
            onNavigateToItem('tour', booking.tour_id);
          }
        } catch (error) {
          console.error('Error finding tour for booking:', error);
          // Fallback to opening the booking
          onNavigateToItem('booking', notification.related_id);
        }
      } else if (notification.type === 'booking') {
        console.log('Navigating to booking:', notification.related_id);
        onNavigateToItem('booking', notification.related_id, notification.message.includes('hotel') ? 'auto-navigate' : undefined);
      } else if (notification.type === 'tour') {
        console.log('Navigating to tour:', notification.related_id);
        onNavigateToItem('tour', notification.related_id);
      } else if (notification.type === 'task') {
        console.log('Navigating to task:', notification.related_id);
        onNavigateToItem('task', notification.related_id);
      } else if (notification.type === 'system') {
        // For system notifications, check if it's a dietary update
        if (notification.message.includes('Dietary requirements') || notification.message.includes('dietary requirements')) {
          // Check if the related_id is a booking ID (new format) or customer ID (old format)
          try {
            // First try to find a booking with this ID
            const { data: booking } = await supabase
              .from('bookings')
              .select('id')
              .eq('id', notification.related_id)
              .single();

            if (booking) {
              console.log('Opening booking for dietary update:', notification.related_id);
              onNavigateToItem('booking', notification.related_id);
            } else {
              // Fallback: find the most recent booking for this customer
              const { data: bookings } = await supabase
                .from('bookings')
                .select('id')
                .eq('lead_passenger_id', notification.related_id)
                .order('created_at', { ascending: false })
                .limit(1);

              if (bookings && bookings.length > 0) {
                console.log('Opening booking for dietary update (fallback):', bookings[0].id);
                onNavigateToItem('booking', bookings[0].id);
              }
            }
          } catch (error) {
            console.error('Error finding booking for dietary update:', error);
          }
        } else {
          // For other system notifications, try to navigate to the related item
          onNavigateToItem('system', notification.related_id);
        }
      }
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Delete button clicked for notification:', notification.id);
    if (onDelete) {
      onDelete(notification.id);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    onCheckboxChange(notification.id, checked);
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 border-l-2 ${getPriorityColor(notification.priority)} ${
        notification.read ? 'bg-gray-50/30' : 'bg-blue-50/50'
      } hover:bg-gray-100/50 rounded-r transition-colors cursor-pointer group`}
      onClick={handleNotificationClick}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={handleCheckboxChange}
        className="h-3 w-3"
        data-checkbox="true"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-shrink-0">
        <NotificationIcon type={notification.type} priority={notification.priority} />
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`font-medium text-xs truncate ${
            notification.read ? 'text-gray-600' : 'text-gray-900'
          }`}>
            {notification.title}
          </span>
          <span className={`text-xs truncate ${
            notification.read ? 'text-gray-500' : 'text-muted-foreground'
          }`}>
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
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
