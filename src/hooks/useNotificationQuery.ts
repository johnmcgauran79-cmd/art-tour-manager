
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
      
      // Build OR conditions for user notifications, department notifications, and general notifications
      const conditions = [`user_id.eq.${user.id}`];
      
      if (userDepartments.length > 0) {
        conditions.push(`and(department.in.(${userDepartments.join(',')}),user_id.is.null)`);
      }
      
      conditions.push('and(department.is.null,user_id.is.null)');
      const orCondition = conditions.join(',');

      // Get dismissed notification IDs for this user
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

      // Exclude dismissed notifications
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

      return { 
        notifications: notificationsResult.data || [], 
        totalUnreadCount: unreadCountResult.count || 0 
      };
    },
    enabled: !!user?.id,
    staleTime: 1000, // Reduced from 5000 to make notifications appear faster
    refetchInterval: 10000, // Reduced from 30000 to refresh more frequently
  });
};
