
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { Database } from "@/integrations/supabase/types";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

export const useNotificationQuery = (limit: number = 10) => {
  const { user } = useAuth();
  const { data: userDepartments = [] } = useUserDepartments();

  return useQuery({
    queryKey: ['notifications', user?.id, userDepartments, limit],
    queryFn: async (): Promise<{ notifications: Notification[]; totalUnreadCount: number }> => {
      if (!user?.id) return { notifications: [], totalUnreadCount: 0 };
      
      console.log('Fetching notifications for user:', user.id, 'with departments:', userDepartments);
      
      // Build OR conditions for user notifications, department notifications, and general notifications
      const conditions = [`user_id.eq.${user.id}`];
      
      // Add department-based notifications if user has departments
      if (userDepartments.length > 0) {
        conditions.push(`and(department.in.(${userDepartments.join(',')}),user_id.is.null)`);
      }
      
      // Add general notifications (no department and no specific user)
      conditions.push('and(department.is.null,user_id.is.null)');
      
      const orCondition = conditions.join(',');

      // First get dismissed notification IDs for this user
      const { data: dismissedNotifications } = await supabase
        .from('user_notification_dismissals')
        .select('notification_id')
        .eq('user_id', user.id);

      const dismissedIds = dismissedNotifications?.map(d => d.notification_id) || [];

      let notificationsQuery = supabase
        .from('user_notifications')
        .select('*')
        .or(orCondition)
        .order('created_at', { ascending: false })
        .limit(limit);

      let unreadCountQuery = supabase
        .from('user_notifications')
        .select('id', { count: 'exact' })
        .or(orCondition)
        .eq('read', false);

      // If there are dismissed notifications, exclude them
      if (dismissedIds.length > 0) {
        notificationsQuery = notificationsQuery.not('id', 'in', `(${dismissedIds.join(',')})`);
        unreadCountQuery = unreadCountQuery.not('id', 'in', `(${dismissedIds.join(',')})`);
      }

      const [notificationsResult, unreadCountResult] = await Promise.all([
        notificationsQuery,
        unreadCountQuery
      ]);

      if (notificationsResult.error) throw notificationsResult.error;
      if (unreadCountResult.error) throw unreadCountResult.error;

      console.log('Fetched notifications count:', notificationsResult.data?.length || 0);
      console.log('Unread count:', unreadCountResult.count || 0);

      return { 
        notifications: notificationsResult.data || [], 
        totalUnreadCount: unreadCountResult.count || 0 
      };
    },
    enabled: !!user?.id,
    staleTime: 5000,
    refetchInterval: 30000,
  });
};
