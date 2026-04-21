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
}) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['tasks', tourId, filters],
    queryFn: async () => {
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

        console.log('Fetching my tasks for user:', user.id);

        // First, get user's departments
        const { data: userDepartments, error: deptError } = await supabase
          .from('user_departments')
          .select('department')
          .eq('user_id', user.id);

        if (deptError) {
          console.warn('[useMyTasks] Could not fetch user departments:', deptError.message);
        }

        const departments = userDepartments?.map(d => d.department) || [];
        console.log('[useMyTasks] User departments:', departments);

        // Get all tasks with their assignments
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

        // Filter tasks that should be shown to the user
        const myTasks = allTasks?.filter(task => {
          // Show tasks created by the user
          if (task.created_by === user.id) return true;
          
          // Show tasks assigned to the user
          if (task.task_assignments && task.task_assignments.some(assignment => assignment.user_id === user.id)) return true;
          
          // Show tasks that match user's departments
          if (departments.length > 0 && departments.includes(task.category)) return true;
          
          // Show unassigned tasks only if user belongs to the task's department
          if ((!task.task_assignments || task.task_assignments.length === 0) && departments.length > 0 && departments.includes(task.category)) return true;
          
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
