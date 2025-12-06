import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const usePendingEmailApprovals = () => {
  return useQuery({
    queryKey: ['pending-email-approvals'],
    queryFn: async () => {
      // Fetch batch approvals (where booking_id is null and tour_id is set)
      const { data, error } = await supabase
        .from('automated_email_log')
        .select(`
          *,
          tour:tours(
            id,
            name,
            start_date,
            end_date
          ),
          rule:automated_email_rules(
            rule_name,
            days_before_tour,
            email_templates:email_templates(
              name,
              subject_template,
              content_template,
              from_email
            )
          )
        `)
        .eq('approval_status', 'pending_approval')
        .is('booking_id', null) // Only batch records
        .not('tour_id', 'is', null) // Must have tour_id
        .order('tour_start_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useApproveEmails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (approvalIds: string[]) => {
      // Update approval status
      const { error } = await supabase
        .from('automated_email_log')
        .update({ 
          approval_status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString()
        })
        .in('id', approvalIds);

      if (error) throw error;

      // Trigger the email processing function to send approved emails immediately
      const { error: invokeError } = await supabase.functions.invoke('process-automated-emails');
      
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
    onSuccess: (_, approvalIds) => {
      queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['automated-email-log'] });
      toast({
        title: "Batch Approved & Sent",
        description: `${approvalIds.length} tour email batch(es) approved. Emails are being sent.`,
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

export const useRejectEmails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ approvalIds, reason }: { approvalIds: string[]; reason?: string }) => {
      const { error } = await supabase
        .from('automated_email_log')
        .update({ 
          approval_status: 'rejected',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .in('id', approvalIds);

      if (error) throw error;
    },
    onSuccess: (_, { approvalIds }) => {
      queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['automated-email-log'] });
      toast({
        title: "Batch Rejected",
        description: `${approvalIds.length} tour email batch(es) rejected.`,
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
