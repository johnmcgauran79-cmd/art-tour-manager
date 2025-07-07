
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
      
      console.log('Fetching notifications for user:', user.id, 'departments:', userDepartments);
      
      // Build query conditions for notifications
      const conditions = [`user_id.eq.${user.id}`];
      
      // Add department-based notifications if user has departments
      if (userDepartments.length > 0) {
        conditions.push(`and(department.in.(${userDepartments.join(',')}),user_id.is.null)`);
      }
      
      // Add general notifications (no department and no specific user)
      conditions.push('and(department.is.null,user_id.is.null)');
      
      const orCondition = conditions.join(',');

      const [notificationsResult, unreadCountResult] = await Promise.all([
        supabase
          .from('user_notifications')
          .select('*')
          .or(orCondition)
          .order('created_at', { ascending: false })
          .limit(limit),
        
        supabase
          .from('user_notifications')
          .select('id', { count: 'exact' })
          .or(orCondition)
          .eq('read', false)
      ]);

      if (notificationsResult.error) {
        console.error('Error fetching notifications:', notificationsResult.error);
        throw notificationsResult.error;
      }

      if (unreadCountResult.error) {
        console.error('Error fetching unread count:', unreadCountResult.error);
        throw unreadCountResult.error;
      }

      const notifications = notificationsResult.data || [];
      const totalUnreadCount = unreadCountResult.count || 0;

      console.log('Fetched notifications:', notifications.length, 'Total unread:', totalUnreadCount);
      
      return { notifications, totalUnreadCount };
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
};
