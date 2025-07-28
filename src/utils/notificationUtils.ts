import { supabase } from '@/integrations/supabase/client';

// Helper function to create individual notifications for users in specific departments
export const createDepartmentNotifications = async (
  departments: ('operations' | 'finance' | 'marketing' | 'booking' | 'maintenance' | 'general')[],
  notificationTemplate: {
    title: string;
    message: string;
    type: string;
    priority: string;
    related_id: string;
  }
) => {
  const notifications = [];

  for (const department of departments) {
    const { data: users } = await supabase
      .from('user_departments')
      .select('user_id')
      .eq('department', department);

    if (users) {
      for (const user of users) {
        notifications.push({
          user_id: user.user_id,
          title: notificationTemplate.title,
          message: notificationTemplate.message,
          type: notificationTemplate.type,
          priority: notificationTemplate.priority,
          related_id: notificationTemplate.related_id,
          department: null // Individual notifications don't need department
        });
      }
    }
  }

  return notifications;
};