
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
  date_field_type: 'tour_start_date' | 'tour_end_date' | 'initial_rooms_cutoff_date' | 'final_rooms_cutoff_date' | 'instalment_date' | 'final_payment_date';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assignee_user_ids?: string[];
  template_type: 'tour' | 'standalone';
  default_status: string;
  approval_policy: 'all' | 'any';
  default_url_reference: string | null;
  approver_user_ids?: string[];
}

export const useTaskTemplates = () => {
  return useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      console.log('Fetching task templates...');
      
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .order('days_before_tour', { ascending: false });

      if (error) {
        console.error('Error fetching task templates:', error);
        throw error;
      }

      const { data: assignees, error: aErr } = await supabase
        .from('task_template_assignees' as any)
        .select('template_id, user_id');
      if (aErr) console.error('Error fetching template assignees:', aErr);

      const byTemplate = new Map<string, string[]>();
      ((assignees as any[]) || []).forEach((row) => {
        const arr = byTemplate.get(row.template_id) || [];
        arr.push(row.user_id);
        byTemplate.set(row.template_id, arr);
      });

      const { data: approvers, error: apErr } = await supabase
        .from('task_template_approvers' as any)
        .select('template_id, user_id');
      if (apErr) console.error('Error fetching template approvers:', apErr);
      const approversByTemplate = new Map<string, string[]>();
      ((approvers as any[]) || []).forEach((row) => {
        const arr = approversByTemplate.get(row.template_id) || [];
        arr.push(row.user_id);
        approversByTemplate.set(row.template_id, arr);
      });

      const result = (data || []).map((t: any) => ({
        ...t,
        assignee_user_ids: byTemplate.get(t.id) || [],
        approver_user_ids: approversByTemplate.get(t.id) || [],
      })) as TaskTemplate[];

      console.log('Task templates fetched successfully:', result.length, 'templates');
      return result;
    },
  });
};

const syncAssignees = async (templateId: string, userIds: string[] | undefined) => {
  if (!userIds) return;
  const { error: delErr } = await supabase
    .from('task_template_assignees' as any)
    .delete()
    .eq('template_id', templateId);
  if (delErr) throw delErr;
  if (userIds.length > 0) {
    const { error: insErr } = await supabase
      .from('task_template_assignees' as any)
      .insert(userIds.map((user_id) => ({ template_id: templateId, user_id })));
    if (insErr) throw insErr;
  }
};

const syncApprovers = async (templateId: string, userIds: string[] | undefined) => {
  if (!userIds) return;
  const { error: delErr } = await supabase
    .from('task_template_approvers' as any)
    .delete()
    .eq('template_id', templateId);
  if (delErr) throw delErr;
  if (userIds.length > 0) {
    const { error: insErr } = await supabase
      .from('task_template_approvers' as any)
      .insert(userIds.map((user_id) => ({ template_id: templateId, user_id })));
    if (insErr) throw insErr;
  }
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
      date_field_type?: TaskTemplate['date_field_type'];
      is_active?: boolean;
      assignee_user_ids?: string[];
      template_type?: 'tour' | 'standalone';
      default_status?: string;
      approval_policy?: 'all' | 'any';
      default_url_reference?: string | null;
      approver_user_ids?: string[];
    }) => {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({
          name: templateData.name,
          description: templateData.description || null,
          category: templateData.category,
          priority: templateData.priority,
          days_before_tour: templateData.days_before_tour || null,
          date_field_type: templateData.date_field_type || 'tour_start_date',
          is_active: templateData.is_active ?? true,
          template_type: templateData.template_type ?? 'tour',
          default_status: templateData.default_status ?? 'not_started',
          approval_policy: templateData.approval_policy ?? 'all',
          default_url_reference: templateData.default_url_reference ?? null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      await syncAssignees(data.id, templateData.assignee_user_ids);
      await syncApprovers(data.id, templateData.approver_user_ids);
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
      updates: Partial<Pick<TaskTemplate, 'name' | 'description' | 'category' | 'priority' | 'days_before_tour' | 'date_field_type' | 'is_active' | 'assignee_user_ids' | 'template_type' | 'default_status' | 'approval_policy' | 'default_url_reference' | 'approver_user_ids'>>;
    }) => {
      const { assignee_user_ids, approver_user_ids, ...rest } = data.updates as any;
      const { data: template, error } = await supabase
        .from('task_templates')
        .update(rest)
        .eq('id', data.templateId)
        .select()
        .single();

      if (error) throw error;
      if (assignee_user_ids !== undefined) {
        await syncAssignees(data.templateId, assignee_user_ids);
      }
      if (approver_user_ids !== undefined) {
        await syncApprovers(data.templateId, approver_user_ids);
      }
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
