import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EmailTemplate } from "@/utils/emailTemplateEngine";

export const useEmailTemplates = (type?: string) => {
  return useQuery({
    queryKey: ['email-templates', type],
    queryFn: async () => {
      let query = supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (type) {
        query = query.eq('type', type);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
};

export const useEmailTemplate = (id: string) => {
  return useQuery({
    queryKey: ['email-template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as EmailTemplate;
    },
    enabled: !!id,
  });
};

export const useCreateEmailTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const user = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          ...template,
          created_by: user.data.user?.id || ''
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({
        title: "Success",
        description: "Email template created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create email template",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateEmailTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({
        title: "Success",
        description: "Email template updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update email template",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteEmailTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({
        title: "Success",
        description: "Email template deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete email template",
        variant: "destructive",
      });
    },
  });
};