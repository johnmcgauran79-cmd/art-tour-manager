import { supabase } from '@/integrations/supabase/client';

// Helper function to create notifications for task assignments
export const createTaskNotifications = async (
  taskId: string,
  notificationTemplate: {
    title: string;
    message: string;
    type: string;
    priority: string;
    related_id: string;
  }
) => {
  const notifications = [];
  const uniqueUserIds = new Set<string>();

  // Get assigned users for this task
  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('user_id')
    .eq('task_id', taskId);

  if (assignments) {
    for (const assignment of assignments) {
      uniqueUserIds.add(assignment.user_id);
    }
  }

  // Also notify operations department (but avoid duplicates)
  const { data: operationsUsers } = await supabase
    .from('user_departments')
    .select('user_id')
    .eq('department', 'operations');

  if (operationsUsers) {
    for (const user of operationsUsers) {
      uniqueUserIds.add(user.user_id);
    }
  }

  // Create one notification per unique user
  for (const userId of uniqueUserIds) {
    notifications.push({
      user_id: userId,
      title: notificationTemplate.title,
      message: notificationTemplate.message,
      type: notificationTemplate.type,
      priority: notificationTemplate.priority,
      related_id: notificationTemplate.related_id,
      department: null // Individual notifications don't need department
    });
  }

  return notifications;
};