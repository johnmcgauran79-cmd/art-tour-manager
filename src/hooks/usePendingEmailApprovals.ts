import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const usePendingEmailApprovals = () => {
  return useQuery({
    queryKey: ['pending-email-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automated_email_log')
        .select(`
          *,
          booking:bookings(
            id,
            passenger_count,
            lead_passenger:customers!bookings_lead_passenger_id_fkey(
              first_name,
              last_name,
              email
            ),
            tour:tours(
              id,
              name,
              start_date,
              end_date
            )
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
      const { error } = await supabase
        .from('automated_email_log')
        .update({ 
          approval_status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString()
        })
        .in('id', approvalIds);

      if (error) throw error;
    },
    onSuccess: (_, approvalIds) => {
      queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['automated-email-log'] });
      toast({
        title: "Emails Approved",
        description: `${approvalIds.length} email(s) approved and will be sent on the next processing run.`,
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
        title: "Emails Rejected",
        description: `${approvalIds.length} email(s) rejected.`,
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
