
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

      const [notificationsResult, unreadCountResult] = await Promise.all([
        supabase
          .from('user_notifications')
          .select(`
            *,
            user_notification_dismissals!left(id)
          `)
          .or(orCondition)
          .is('user_notification_dismissals.id', null) // Exclude dismissed notifications
          .order('created_at', { ascending: false })
          .limit(limit),
        
        supabase
          .from('user_notifications')
          .select('id', { count: 'exact' })
          .or(orCondition)
          .eq('read', false)
          .is('user_notification_dismissals.id', null) // Exclude dismissed notifications from count
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
