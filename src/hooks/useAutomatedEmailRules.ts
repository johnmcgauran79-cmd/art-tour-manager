import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAutomatedEmailRules = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['automated-email-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automated_email_rules')
        .select('*, email_templates(*)')
        .order('days_before_tour', { ascending: false });

      if (error) throw error;
      return data;
    }
  });
};

export const useCreateAutomatedEmailRule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: {
      rule_name: string;
      rule_type: string;
      trigger_type?: string;
      days_before_tour: number;
      email_template_id: string;
      is_active: boolean;
      requires_approval?: boolean;
      recipient_filter?: string;
      status_filter?: string[];
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from('automated_email_rules')
        .insert(rule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-email-rules'] });
      toast({
        title: "Rule created",
        description: "Automated email rule has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create automated email rule.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateAutomatedEmailRule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('automated_email_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-email-rules'] });
      toast({
        title: "Rule updated",
        description: "Automated email rule has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update automated email rule.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteAutomatedEmailRule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automated_email_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-email-rules'] });
      toast({
        title: "Rule deleted",
        description: "Automated email rule has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete automated email rule.",
        variant: "destructive",
      });
    },
  });
};

export const useAutomatedEmailLog = () => {
  return useQuery({
    queryKey: ['automated-email-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automated_email_log')
        .select(`
          *,
          booking:bookings(
            id,
            lead_passenger:customers!bookings_lead_passenger_id_fkey(first_name, last_name, email),
            tour:tours(name, start_date)
          ),
          rule:automated_email_rules(rule_name, days_before_tour)
        `)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    }
  });
};