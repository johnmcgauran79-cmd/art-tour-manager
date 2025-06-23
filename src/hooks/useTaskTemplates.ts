
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  category: 'booking' | 'operations' | 'finance' | 'marketing' | 'maintenance' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  days_before_tour: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useTaskTemplates = () => {
  return useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      console.log('Fetching task templates...');
      
      const { data, error, count } = await supabase
        .from('task_templates')
        .select('*', { count: 'exact' })
        .order('days_before_tour', { ascending: false });

      console.log('Task templates query result:', { data, error, count });

      if (error) {
        console.error('Error fetching task templates:', error);
        throw error;
      }

      console.log('Task templates fetched successfully:', data?.length || 0, 'templates');
      return data as TaskTemplate[];
    },
  });
};

export const useCreateTaskTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateData: {
      name: string;
      description?: string;
      category: TaskTemplate['category'];
      priority: TaskTemplate['priority'];
      days_before_tour?: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({
          name: templateData.name,
          description: templateData.description || null,
          category: templateData.category,
          priority: templateData.priority,
          days_before_tour: templateData.days_before_tour || null,
          is_active: templateData.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast({
        title: "Template Created",
        description: "Task template has been successfully created.",
      });
    },
    onError: (error) => {
      console.error('Error creating task template:', error);
      toast({
        title: "Error",
        description: "Failed to create task template. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTaskTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      templateId: string;
      updates: Partial<Pick<TaskTemplate, 'name' | 'description' | 'category' | 'priority' | 'days_before_tour' | 'is_active'>>;
    }) => {
      const { data: template, error } = await supabase
        .from('task_templates')
        .update(data.updates)
        .eq('id', data.templateId)
        .select()
        .single();

      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast({
        title: "Template Updated",
        description: "Task template has been successfully updated.",
      });
    },
    onError: (error) => {
      console.error('Error updating task template:', error);
      toast({
        title: "Error",
        description: "Failed to update task template. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTaskTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      return { templateId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast({
        title: "Template Deleted",
        description: "Task template has been successfully deleted.",
      });
    },
    onError: (error) => {
      console.error('Error deleting task template:', error);
      toast({
        title: "Error",
        description: "Failed to delete task template. Please try again.",
        variant: "destructive",
      });
    },
  });
};
