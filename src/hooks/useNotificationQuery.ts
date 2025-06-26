
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
      
      console.log('Fetching notifications for user:', user.id, 'departments:', userDepartments, 'limit:', limit);
      
      // Build base query conditions
      let baseCondition = `user_id.eq.${user.id}`;
      if (userDepartments.length > 0) {
        baseCondition = `user_id.eq.${user.id},department.in.(${userDepartments.join(',')})`;
      }

      // Fetch limited notifications for display
      let notificationsQuery = supabase
        .from('user_notifications')
        .select('*')
        .or(baseCondition)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Fetch total unread count
      let unreadCountQuery = supabase
        .from('user_notifications')
        .select('id', { count: 'exact' })
        .or(baseCondition)
        .eq('read', false);

      const [notificationsResult, unreadCountResult] = await Promise.all([
        notificationsQuery,
        unreadCountQuery
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
  });
};
