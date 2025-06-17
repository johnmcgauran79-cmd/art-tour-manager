import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'booking' | 'operations' | 'finance' | 'marketing' | 'maintenance' | 'general';
  due_date: string | null;
  tour_id: string | null;
  created_by: string;
  completed_at: string | null;
  is_automated: boolean;
  automated_rule: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
  tours?: {
    name: string;
  };
  task_assignments?: Array<{
    user_id: string;
  }>;
}

export const useTasks = (tourId?: string) => {
  return useQuery({
    queryKey: ['tasks', tourId],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          tours (name),
          task_assignments (user_id)
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (tourId) {
        query = query.eq('tour_id', tourId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      return data as Task[];
    },
  });
};

export const useMyTasks = () => {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Get tasks assigned to the user
      const { data: assignedTasks, error: assignedError } = await supabase
        .from('tasks')
        .select(`
          *,
          tours (name),
          task_assignments!inner (user_id)
        `)
        .eq('task_assignments.user_id', user.user.id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (assignedError) {
        console.error('Error fetching assigned tasks:', assignedError);
        throw assignedError;
      }

      // Get unallocated tasks (tasks with no assignments)
      const { data: unallocatedTasks, error: unallocatedError } = await supabase
        .from('tasks')
        .select(`
          *,
          tours (name),
          task_assignments (user_id)
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (unallocatedError) {
        console.error('Error fetching unallocated tasks:', unallocatedError);
        throw unallocatedError;
      }

      // Filter out tasks that have assignments
      const filteredUnallocatedTasks = unallocatedTasks?.filter(task => 
        !task.task_assignments || task.task_assignments.length === 0
      ) || [];

      // Combine assigned and unallocated tasks, removing duplicates
      const allTasks = [...(assignedTasks || []), ...filteredUnallocatedTasks];
      const uniqueTasks = allTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );

      return uniqueTasks as Task[];
    },
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      category: 'booking' | 'operations' | 'finance' | 'marketing' | 'maintenance' | 'general';
      due_date?: string;
      tour_id?: string;
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

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'category' | 'due_date' | 'completed_at'>>;
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
