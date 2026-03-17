import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdditionalInfoTemplate {
  id: string;
  name: string;
  icon_name: string;
  default_content: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useAdditionalInfoTemplates = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['additional-info-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('additional_info_templates')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as AdditionalInfoTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: { name: string; icon_name: string; default_content?: string; sort_order?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('additional_info_templates')
        .insert({ ...template, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['additional-info-templates'] });
      toast({ title: "Template created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AdditionalInfoTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('additional_info_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['additional-info-templates'] });
      toast({ title: "Template updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('additional_info_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['additional-info-templates'] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate };
};
