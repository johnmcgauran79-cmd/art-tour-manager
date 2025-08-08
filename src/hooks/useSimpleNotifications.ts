import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type NotificationData = {
  title: string;
  message: string;
  type: 'booking' | 'tour' | 'task' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_id?: string;
};

export const useSimpleNotifications = () => {
  const { toast } = useToast();

  const sendNotificationToDepartments = async (
    departments: ('operations' | 'finance' | 'marketing' | 'booking' | 'maintenance' | 'general')[],
    notification: NotificationData
  ) => {
    try {
      console.log('📩 Sending notification to departments:', departments, notification.title);

      // Get all users from specified departments
      const uniqueUserIds = new Set<string>();

      for (const department of departments) {
        const { data: users, error } = await supabase
          .from('user_departments')
          .select('user_id')
          .eq('department', department);

        if (error) {
          console.error(`❌ Error fetching users from ${department}:`, error);
          continue;
        }

        if (users) {
          users.forEach(user => uniqueUserIds.add(user.user_id));
        }
      }

      const userIds = Array.from(uniqueUserIds);
      console.log(`📩 Found ${userIds.length} users to notify`);

      if (userIds.length === 0) {
        console.warn('⚠️ No users found in specified departments');
        return false;
      }

      // Create notifications for all users
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        related_id: notification.related_id,
        department: null
      }));

      const { error } = await supabase
        .from('user_notifications')
        .insert(notifications);

      if (error) {
        console.error('❌ Failed to create notifications:', error);
        toast({
          title: "Error",
          description: "Failed to send notifications",
          variant: "destructive",
        });
        return false;
      }

      console.log(`✅ Successfully sent notifications to ${userIds.length} users`);
      return true;
    } catch (error) {
      console.error('❌ Error in sendNotificationToDepartments:', error);
      toast({
        title: "Error",
        description: "Failed to send notifications",
        variant: "destructive",
      });
      return false;
    }
  };

  const sendBookingCreatedNotification = async (bookingId: string, customerName: string, tourName: string) => {
    return sendNotificationToDepartments(['operations', 'booking'], {
      title: 'New Booking Created',
      message: `New booking created for ${customerName} on "${tourName}"`,
      type: 'booking',
      priority: 'medium',
      related_id: bookingId
    });
  };

  const sendBookingUpdatedNotification = async (bookingId: string, customerName: string, tourName: string, changeDescription: string) => {
    return sendNotificationToDepartments(['operations', 'booking'], {
      title: 'Booking Updated',
      message: `Booking for ${customerName} on "${tourName}" - ${changeDescription}`,
      type: 'booking',
      priority: 'medium',
      related_id: bookingId
    });
  };

  const sendBookingDeletedNotification = async (bookingId: string) => {
    return sendNotificationToDepartments(['operations', 'booking'], {
      title: 'Booking Deleted',
      message: 'A booking has been deleted from the system',
      type: 'booking',
      priority: 'medium',
      related_id: bookingId
    });
  };

  const sendTourCreatedNotification = async (tourId: string, tourName: string) => {
    return sendNotificationToDepartments(['operations', 'booking'], {
      title: 'New Tour Created',
      message: `New tour "${tourName}" has been created`,
      type: 'tour',
      priority: 'medium',
      related_id: tourId
    });
  };

  return {
    sendNotificationToDepartments,
    sendBookingCreatedNotification,
    sendBookingUpdatedNotification,
    sendBookingDeletedNotification,
    sendTourCreatedNotification,
  };
};