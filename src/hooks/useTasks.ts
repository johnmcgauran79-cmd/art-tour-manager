import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

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
      console.log('Deleting task:', taskId);
      
      // First get task details for logging
      const { data: taskData } = await supabase
        .from('tasks')
        .select('title, tour_id, created_by')
        .eq('id', taskId)
        .single();

      // Delete task assignments first
      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', taskId);

      if (assignmentError) {
        console.error('Error deleting task assignments:', assignmentError);
        throw new Error(`Failed to delete task assignments: ${assignmentError.message}`);
      }

      // Delete task comments
      const { error: commentsError } = await supabase
        .from('task_comments')    
        .delete()
        .eq('task_id', taskId);

      if (commentsError) {
        console.error('Error deleting task comments:', commentsError);
        throw new Error(`Failed to delete task comments: ${commentsError.message}`);
      }

      // Delete task attachments
      const { error: attachmentsError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('task_id', taskId);

      if (attachmentsError) {
        console.error('Error deleting task attachments:', attachmentsError);
        throw new Error(`Failed to delete task attachments: ${attachmentsError.message}`);
      }

      // Finally delete the task itself
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        throw new Error(`Failed to delete task: ${error.message}`);
      }

      // Log the deletion
      if (taskData) {
        logOperation({
          operation_type: 'DELETE',
          table_name: 'tasks',
          record_id: taskId,
          details: {
            task_title: taskData.title,
            tour_id: taskData.tour_id,
            deleted_manually: true
          }
        });
      }

      console.log('Task deleted successfully:', taskId);
      return { taskId, taskData };
    },
    onSuccess: (data) => {
      console.log('Task deletion successful, invalidating queries');
      // Invalidate all task-related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      
      // Force refetch to ensure immediate UI update
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['my-tasks'] });
      
      toast({
        title: "Task Deleted",
        description: `Task "${data.taskData?.title || 'Unknown'}" has been successfully deleted.`,
      });
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
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
      toast({
        title: "Task Created",
        description: "The task has been successfully created.",
      });
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
      updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'category' | 'due_date' | 'completed_at' | 'depends_on_task_id'>>;
    }) => {
      const updateData = { ...data.updates };
      
      // If marking as completed, set completed_at
      if (data.updates.status === 'completed' && !data.updates.completed_at) {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { data: task, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', data.taskId)
        .select()
        .single();

      if (error) throw error;

      // Log the task update
      logOperation({
        operation_type: 'UPDATE',
        table_name: 'tasks',
        record_id: data.taskId,
        details: {
          updated_fields: Object.keys(updateData),
          status_change: data.updates.status ? `to ${data.updates.status}` : undefined
        }
      });

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast({
        title: "Task Updated",
        description: "The task has been successfully updated.",
      });
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    },
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

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      // Transform the data to match our Task interface
      const transformedData = data?.map(task => ({
        ...task,
        dependent_task: task.dependent_task?.[0] || null
      })) || [];

      return transformedData as Task[];
    },
  });
};

export const useMyTasks = () => {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      console.log('Fetching my tasks for user:', user.user.id);

      // First, get user's departments
      const { data: userDepartments } = await supabase
        .from('user_departments')
        .select('department')
        .eq('user_id', user.user.id);

      const departments = userDepartments?.map(d => d.department) || [];
      console.log('User departments:', departments);

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
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      console.log('All tasks fetched:', allTasks?.length);

      // Filter tasks that should be shown to the user
      const myTasks = allTasks?.filter(task => {
        // Show tasks created by the user
        if (task.created_by === user.user.id) {
          return true;
        }
        
        // Show tasks assigned to the user
        if (task.task_assignments && task.task_assignments.some(assignment => assignment.user_id === user.user.id)) {
          return true;
        }
        
        // Show tasks that match user's departments (if user has departments)
        if (departments.length > 0 && departments.includes(task.category)) {
          return true;
        }
        
        // Show unassigned tasks (tasks with no assignments) only if user belongs to the task's department
        if ((!task.task_assignments || task.task_assignments.length === 0) && 
            departments.length > 0 && departments.includes(task.category)) {
          return true;
        }
        
        return false;
      }) || [];

      console.log('Filtered my tasks:', myTasks.length);

      // Transform the data to match our Task interface
      const transformedData = myTasks.map(task => ({
        ...task,
        dependent_task: task.dependent_task?.[0] || null
      }));

      return transformedData as Task[];
    },
  });
};
