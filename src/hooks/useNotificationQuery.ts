
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
    queryFn: async (): Promise<Notification[]> => {
      if (!user?.id) return [];
      
      console.log('Fetching notifications for user:', user.id, 'departments:', userDepartments, 'limit:', limit);
      
      let query = supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      // If user has departments, also include notifications for those departments
      if (userDepartments.length > 0) {
        query = supabase
          .from('user_notifications')
          .select('*')
          .or(`user_id.eq.${user.id},department.in.(${userDepartments.join(',')})`)
          .order('created_at', { ascending: false })
          .limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
      console.log('Fetched notifications:', data);
      return data || [];
    },
    enabled: !!user?.id,
  });
};
