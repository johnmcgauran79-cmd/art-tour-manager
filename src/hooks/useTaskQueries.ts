import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'waiting' | 'completed' | 'cancelled' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'booking' | 'operations' | 'finance' | 'marketing' | 'maintenance' | 'general';
  due_date: string | null;
  tour_id: string | null;
  created_by: string;
  completed_at: string | null;
  is_automated: boolean;
  automated_rule: string | null;
  parent_task_id: string | null;
  depends_on_task_id: string | null;
  url_reference: string | null;
  created_at: string;
  updated_at: string;
  quick_update: string | null;
  quick_update_at: string | null;
  quick_update_by: string | null;
  last_activity_at: string;
  tours?: {
    name: string;
  };
  task_assignments?: Array<{
    user_id: string;
    profiles?: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  }>;
  dependent_task?: {
    id: string;
    title: string;
    status: string;
  };
}

export const useTasks = (tourId?: string, filters?: {
  search?: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  mentionsMe?: boolean;
}) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['tasks', tourId, filters],
    queryFn: async () => {
      // If "mentions me" filter is active, first resolve which task IDs the
      // current user has unread @mention notifications for.
      let mentionTaskIds: string[] | null = null;
      if (filters?.mentionsMe && user?.id) {
        const { data: notifs } = await supabase
          .from('user_notifications')
          .select('related_id, title')
          .eq('user_id', user.id)
          .eq('type', 'task')
          .eq('read', false)
          .ilike('title', '%mentioned%');
        mentionTaskIds = Array.from(
          new Set((notifs || []).map((n: any) => n.related_id).filter(Boolean) as string[])
        );
        // Short-circuit: no unread mentions → no tasks
        if (mentionTaskIds.length === 0) {
          return [] as Task[];
        }
      }

      let query = supabase
        .from('tasks')
        .select(`
          *,
          tours (name),
          task_assignments (user_id),
          dependent_task:tasks!depends_on_task_id (
            id, title, status
          )
        `)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (tourId) {
        query = query.eq('tour_id', tourId);
      }

      if (mentionTaskIds && mentionTaskIds.length > 0) {
        query = query.in('id', mentionTaskIds);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as 'not_started' | 'in_progress' | 'waiting' | 'completed' | 'cancelled' | 'archived');
      }

      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority as 'low' | 'medium' | 'high' | 'critical');
      }

      if (filters?.startDate) {
        query = query.gte('due_date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('due_date', filters.endDate);
      }

      if (filters?.assigneeId && filters.assigneeId !== 'all') {
        query = query.eq('task_assignments.user_id', filters.assigneeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Collect unique assignee user_ids and fetch their profiles in one query
      const assigneeIds = Array.from(new Set(
        (data || []).flatMap((t: any) => (t.task_assignments || []).map((a: any) => a.user_id))
      ));
      const profileMap: Record<string, any> = {};
      if (assigneeIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', assigneeIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      const transformedData = (data || []).map((task: any) => ({
        ...task,
        task_assignments: (task.task_assignments || []).map((a: any) => ({
          user_id: a.user_id,
          profiles: profileMap[a.user_id] || null,
        })),
        dependent_task: task.dependent_task?.[0] || null,
      }));

      return transformedData as Task[];
    },
    enabled: !!user,
  });
};

export const useMyTasks = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      try {
        console.log('[useMyTasks] Starting query...');
        console.log('[useMyTasks] Auth user:', { hasUser: !!user, userId: user?.id });
        
        if (!user?.id) {
          console.log('[useMyTasks] No user found, returning empty array');
          return [] as Task[];
        }

        // RLS now restricts visibility to: tasks the user created, is assigned
        // to, is a host on the linked tour, or is a watcher of. We then
        // narrow client-side to "created by me OR assigned to me" for the
        // "My Tasks" view specifically.
        const { data: allTasks, error } = await supabase
          .from('tasks')
          .select(`
            *,
            tours (name),
            task_assignments (user_id),
            dependent_task:tasks!depends_on_task_id (
              id, title, status
            )
          `)
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false });

        console.log('[useMyTasks] Tasks query result:', { hasData: !!allTasks, dataLength: allTasks?.length, error: error?.message });
        if (error) {
          console.error('[useMyTasks] Error fetching tasks:', error);
          return [] as Task[];
        }

        console.log('All tasks fetched:', allTasks?.length);

        // Filter to "created by me OR assigned to me" only.
        const myTasks = allTasks?.filter(task => {
          if (task.created_by === user.id) return true;
          if (task.task_assignments?.some(a => a.user_id === user.id)) return true;
          return false;
        }) || [];

        console.log('Filtered my tasks:', myTasks.length);

        // Collect unique assignee user_ids and fetch their profiles in one query
        const assigneeIds = Array.from(new Set(
          myTasks.flatMap((t: any) => (t.task_assignments || []).map((a: any) => a.user_id))
        ));
        const profileMap: Record<string, any> = {};
        if (assigneeIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', assigneeIds);
          (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
        }

        const transformedData = myTasks.map((task: any) => ({
          ...task,
          task_assignments: (task.task_assignments || []).map((a: any) => ({
            user_id: a.user_id,
            profiles: profileMap[a.user_id] || null,
          })),
          dependent_task: task.dependent_task?.[0] || null,
        }));

        return transformedData as Task[];
      } catch (e) {
        console.warn('useMyTasks failed gracefully, returning empty list');
        return [] as Task[];
      }
    },
    enabled: !!user,
  });
};
