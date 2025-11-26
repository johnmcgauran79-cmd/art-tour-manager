import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AutomatedReportRule {
  id: string;
  rule_name: string;
  schedule_type: 'weekly' | 'monthly' | 'days_before_tour';
  schedule_value: number;
  report_types: string[];
  recipient_emails: string[];
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export const useAutomatedReportRules = () => {
  return useQuery({
    queryKey: ['automated-report-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automated_report_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AutomatedReportRule[];
    },
  });
};

export const useCreateAutomatedReportRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rule: Omit<AutomatedReportRule, 'id' | 'created_at' | 'created_by' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('automated_report_rules')
        .insert({
          ...rule,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-report-rules'] });
      toast({
        title: "Success",
        description: "Automated report rule created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to create automated report rule. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating automated report rule:', error);
    },
  });
};

export const useUpdateAutomatedReportRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomatedReportRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('automated_report_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-report-rules'] });
      toast({
        title: "Success",
        description: "Automated report rule updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update automated report rule. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating automated report rule:', error);
    },
  });
};

export const useDeleteAutomatedReportRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automated_report_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-report-rules'] });
      toast({
        title: "Success",
        description: "Automated report rule deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete automated report rule. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting automated report rule:', error);
    },
  });
};

export const useAutomatedReportLog = () => {
  return useQuery({
    queryKey: ['automated-report-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automated_report_log')
        .select(`
          *,
          automated_report_rules!inner(rule_name)
        `)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });
};

export const useSendTestAutomatedReport = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ report_types, recipient_email, schedule_type, schedule_value }: { 
      report_types: string[], 
      recipient_email: string,
      schedule_type: string,
      schedule_value: number
    }) => {
      const { data, error } = await supabase.functions.invoke('send-test-automated-report', {
        body: { report_types, recipient_email, schedule_type, schedule_value },
      });

      if (error) throw error;
      return data;
    },
    onMutate: () => {
      toast({
        title: "Processing...",
        description: "Generating and preparing your test report email. This may take a moment.",
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Sent",
        description: "Test report email sent successfully. Check your inbox.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to send test report. Please try again.",
        variant: "destructive",
      });
      console.error('Error sending test report:', error);
    },
  });
};