import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface StatusChangeQueueItem {
  id: string;
  rule_id: string;
  booking_id: string;
  tour_id: string | null;
  previous_status: string | null;
  new_status: string;
  triggered_at: string;
  batch_date: string;
  processed_at: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  email_log_id: string | null;
  email_template_id: string | null;
  created_at: string;
  // Joined data
  rule?: {
    rule_name: string;
    email_template_id: string | null;
    trigger_conditions: any;
    email_templates?: {
      name: string;
      subject_template: string;
      content_template: string;
      from_email: string;
    } | null;
  };
  booking?: {
    id: string;
    passenger_count: number;
    lead_passenger_id: string | null;
    customers?: {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;
  };
  tour?: {
    id: string;
    name: string;
    start_date: string;
    tour_type: string | null;
  };
}

// Get pending status change emails grouped by rule and batch date
export const usePendingStatusChangeApprovals = () => {
  return useQuery({
    queryKey: ['pending-status-change-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status_change_email_queue')
        .select(`
          *,
          rule:automated_email_rules(
            rule_name,
            email_template_id,
            trigger_conditions,
            email_templates:email_templates(
              name,
              subject_template,
              content_template,
              from_email
            )
          ),
          booking:bookings(
            id,
            passenger_count,
            lead_passenger_id,
            customers:customers!bookings_lead_passenger_id_fkey(
              first_name,
              last_name,
              email
            )
          ),
          tour:tours(
            id,
            name,
            start_date,
            tour_type
          )
        `)
        .eq('approval_status', 'pending')
        .order('batch_date', { ascending: true })
        .order('triggered_at', { ascending: true });

      if (error) throw error;
      
      // Group by rule_id and batch_date
      const grouped = (data as StatusChangeQueueItem[]).reduce((acc, item) => {
        const key = `${item.rule_id}-${item.batch_date}`;
        if (!acc[key]) {
          acc[key] = {
            rule_id: item.rule_id,
            rule_name: item.rule?.rule_name || 'Unknown Rule',
            batch_date: item.batch_date,
            template_name: item.rule?.email_templates?.name || 'No template',
            items: [],
          };
        }
        acc[key].items.push(item);
        return acc;
      }, {} as Record<string, { rule_id: string; rule_name: string; batch_date: string; template_name: string; items: StatusChangeQueueItem[] }>);
      
      return Object.values(grouped);
    },
    refetchInterval: 120000, // Refresh every 2 minutes (reduced from 30s)
    staleTime: 60000,
  });
};

// Get all status change queue items (for history view)
export const useStatusChangeEmailLog = () => {
  return useQuery({
    queryKey: ['status-change-email-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status_change_email_queue')
        .select(`
          *,
          rule:automated_email_rules(
            rule_name,
            email_template_id,
            trigger_conditions
          ),
          booking:bookings(
            id,
            customers:customers!bookings_lead_passenger_id_fkey(
              first_name,
              last_name,
              email
            )
          ),
          tour:tours(
            id,
            name,
            start_date
          )
        `)
        .neq('approval_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as StatusChangeQueueItem[];
    }
  });
};

export const useApproveStatusChangeEmails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update approval status
      const { error } = await supabase
        .from('status_change_email_queue')
        .update({ 
          approval_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .in('id', queueIds);

      if (error) throw error;

      // Trigger the email processing function
      const { error: invokeError } = await supabase.functions.invoke('process-status-change-emails');
      
      if (invokeError) {
        console.error('Error triggering email processing:', invokeError);
        // Don't throw - approval succeeded, just log the error
      }
    },
    onMutate: () => {
      toast({
        title: "Processing...",
        description: "Approving and sending emails...",
      });
    },
    onSuccess: (_, queueIds) => {
      queryClient.invalidateQueries({ queryKey: ['pending-status-change-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['status-change-email-log'] });
      toast({
        title: "Batch Approved & Sent",
        description: `${queueIds.length} email(s) approved. Emails are being sent.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve emails.",
        variant: "destructive",
      });
    },
  });
};

export const useRejectStatusChangeEmails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ queueIds, reason }: { queueIds: string[]; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('status_change_email_queue')
        .update({ 
          approval_status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .in('id', queueIds);

      if (error) throw error;
    },
    onSuccess: (_, { queueIds }) => {
      queryClient.invalidateQueries({ queryKey: ['pending-status-change-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['status-change-email-log'] });
      toast({
        title: "Batch Rejected",
        description: `${queueIds.length} email(s) rejected.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject emails.",
        variant: "destructive",
      });
    },
  });
};

export const useSwapStatusChangeTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ queueIds, emailTemplateId }: { queueIds: string[]; emailTemplateId: string | null }) => {
      const { error } = await supabase
        .from('status_change_email_queue')
        .update({ email_template_id: emailTemplateId })
        .in('id', queueIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-status-change-approvals'] });
      toast({
        title: "Template Updated",
        description: "The email template for the selected items has been changed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change template.",
        variant: "destructive",
      });
    },
  });
};
