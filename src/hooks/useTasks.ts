import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
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
  tours?: {
    name: string;
  };
  task_assignments?: Array<{
    user_id: string;
  }>;
  dependent_task?: {
    id: string;
    title: string;
    status: string;
  };
}

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (taskId: string) => {
      console.log('Starting task deletion for task ID:', taskId);
      
      // First get task details for logging and notification
      const { data: taskData, error: fetchError } = await supabase
        .from('tasks')
        .select('title, tour_id, created_by, tours(name)')
        .eq('id', taskId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching task details:', fetchError);
        throw new Error(`Failed to fetch task details: ${fetchError.message}`);
      }

      if (!taskData) {
        console.error('Task not found:', taskId);
        throw new Error(`Task not found: ${taskId}`);
      }

      console.log('Task data before deletion:', taskData);

      // Delete task assignments first
      console.log('Deleting task assignments...');
      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', taskId);

      if (assignmentError) {
        console.error('Error deleting task assignments:', assignmentError);
        throw new Error(`Failed to delete task assignments: ${assignmentError.message}`);
      }

      // Delete task comments
      console.log('Deleting task comments...');
      const { error: commentsError } = await supabase
        .from('task_comments')    
        .delete()
        .eq('task_id', taskId);

      if (commentsError) {
        console.error('Error deleting task comments:', commentsError);
        throw new Error(`Failed to delete task comments: ${commentsError.message}`);
      }

      // Delete task attachments
      console.log('Deleting task attachments...');
      const { error: attachmentsError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('task_id', taskId);

      if (attachmentsError) {
        console.error('Error deleting task attachments:', attachmentsError);
        throw new Error(`Failed to delete task attachments: ${attachmentsError.message}`);
      }

      // Finally delete the task itself
      console.log('Deleting the task...');
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (taskError) {
        console.error('Error deleting task:', taskError);
        throw new Error(`Failed to delete task: ${taskError.message}`);
      }

      console.log('Task deletion successful');

      // Log the deletion
      logOperation({
        operation_type: 'DELETE',
        table_name: 'tasks',
        record_id: taskId,
        details: {
          task_title: taskData?.title,
          tour_id: taskData?.tour_id,
          tour_name: taskData?.tours?.name,
          deleted_manually: true
        }
      });

      return { taskId, taskData };
    },
    onSuccess: (data) => {
      console.log('Task deletion mutation successful, updating UI...');
      
      // Force immediate invalidation and refetch of all task-related queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      
      // Force immediate refetch to ensure UI updates
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['my-tasks'] });
      
      // Remove the deleted task from cache immediately
      queryClient.setQueryData(['tasks'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((task: any) => task.id !== data.taskId);
      });
      
      queryClient.setQueryData(['my-tasks'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((task: any) => task.id !== data.taskId);
      });
      
      console.log('Task UI updates complete');
      
      // Don't show any toast here - let realtime handle all notifications to avoid duplicates
    },
    onError: (error) => {
      console.error('Task deletion failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      category: 'booking' | 'operations' | 'finance' | 'marketing' | 'maintenance' | 'general';
      due_date?: string;
      tour_id?: string;
      depends_on_task_id?: string;
      url_reference?: string;
      assignee_ids?: string[];
    }) => {
      console.log('useCreateTask mutation called with:', taskData);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('Authenticated user:', user.user.id);

      // Create the task first
      const taskInsertData = {
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        category: taskData.category,
        due_date: taskData.due_date || null,
        tour_id: taskData.tour_id || null,
        depends_on_task_id: taskData.depends_on_task_id || null,
        url_reference: taskData.url_reference || null,
        created_by: user.user.id,
        status: 'not_started' as const,
        is_automated: false,
      };

      console.log('Inserting task with data:', taskInsertData);

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskInsertData)
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        throw new Error(`Failed to create task: ${taskError.message}`);
      }

      console.log('Task created successfully:', task);

      // Log the task creation
      logOperation({
        operation_type: 'CREATE',
        table_name: 'tasks',
        record_id: task.id,
        details: {
          task_title: task.title,
          priority: task.priority,
          category: task.category,
          tour_id: task.tour_id
        }
      });

      // Add assignments if provided
      if (taskData.assignee_ids && taskData.assignee_ids.length > 0) {
        console.log('Adding assignments for users:', taskData.assignee_ids);
        
        const assignments = taskData.assignee_ids.map(userId => ({
          task_id: task.id,
          user_id: userId,
          assigned_by: user.user.id,
        }));

        console.log('Assignment data:', assignments);

        const { error: assignmentError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignmentError) {
          console.error('Error creating task assignments:', assignmentError);
          throw new Error(`Failed to create task assignments: ${assignmentError.message}`);
        }

        console.log('Task assignments created successfully');
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      // Don't show toast here - let realtime handle notifications to avoid duplicates
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'category' | 'due_date' | 'completed_at' | 'depends_on_task_id' | 'url_reference'>> & { tour_id?: string | null };
    }) => {
      console.log('[useUpdateTask] Starting update for task:', data.taskId, 'with updates:', data.updates);
      
      // First verify the user is authenticated
      const { data: user, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[useUpdateTask] Auth error:', authError);
        throw new Error('Authentication failed. Please log in again.');
      }
      
      if (!user.user) {
        console.error('[useUpdateTask] No authenticated user found');
        throw new Error('You must be logged in to update tasks.');
      }

      console.log('[useUpdateTask] Authenticated user:', user.user.id);

      const updateData = { ...data.updates };
      
      // If marking as completed, set completed_at
      if (data.updates.status === 'completed' && !data.updates.completed_at) {
        updateData.completed_at = new Date().toISOString();
        console.log('[useUpdateTask] Setting completed_at to:', updateData.completed_at);
      }
      
      console.log('[useUpdateTask] Final update data:', updateData);
      
      // Perform the update with a single database call
      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', data.taskId)
        .select()
        .maybeSingle();

      console.log('[useUpdateTask] Database response:', { updatedTask, updateError });

      if (updateError) {
        console.error('[useUpdateTask] Database update error:', updateError);
        throw new Error(`Failed to update task: ${updateError.message}`);
      }
      
      if (!updatedTask) {
        console.error('[useUpdateTask] No task returned from update');
        throw new Error('Failed to update task - you may not have permission to modify this task');
      }

      console.log('[useUpdateTask] Update successful:', updatedTask);
      return updatedTask;
    },
    onSuccess: (task, variables) => {
      // Use setTimeout to defer cache invalidation and prevent race conditions
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      }, 100);
      
      toast({
        title: "Task Updated",
        description: "The task has been successfully updated.",
      });
      
      // Log the task update after successful completion
      logOperation({
        operation_type: 'UPDATE',
        table_name: 'tasks',
        record_id: variables.taskId,
        details: {
          updated_fields: Object.keys(variables.updates),
          status_change: variables.updates.status ? `to ${variables.updates.status}` : undefined
        }
      });
    },
    onError: (error) => {
      console.error('[useUpdateTask] Mutation error:', error);
      toast({
        title: "Error",
        description: `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
    retry: 1,
    retryDelay: 500,
  });
};

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

      // Transform the data to match our Task interface
      const transformedData = data?.map(task => ({
        ...task,
        dependent_task: task.dependent_task?.[0] || null
      })) || [];

      return transformedData as Task[];
    },
    enabled: !!user, // Wait for authentication
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

        // Get all tasks with their assignments (RLS will restrict rows appropriately)
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
          
          // Show tasks that match user's departments (if user has departments)
          if (departments.length > 0 && departments.includes(task.category)) return true;
          
          // Show unassigned tasks only if user belongs to the task's department
          if ((!task.task_assignments || task.task_assignments.length === 0) && departments.length > 0 && departments.includes(task.category)) return true;
          
          return false;
        }) || [];

        console.log('Filtered my tasks:', myTasks.length);

        // Transform the data to match our Task interface
        const transformedData = myTasks.map(task => ({
          ...task,
          dependent_task: task.dependent_task?.[0] || null
        }));

        return transformedData as Task[];
      } catch (e) {
        console.warn('useMyTasks failed gracefully, returning empty list');
        return [] as Task[];
      }
    },
    enabled: !!user, // Wait for authentication
  });
};
