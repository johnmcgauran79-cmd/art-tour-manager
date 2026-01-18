import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AcknowledgeParams {
  issueType: 'bounced' | 'complained' | 'unread';
  emailLogId?: string;
  emailAddress?: string;
  lastEventAt?: string;
}

export const useAcknowledgeEmailIssue = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: AcknowledgeParams) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('email_issue_acknowledgments')
        .insert({
          issue_type: params.issueType,
          email_log_id: params.issueType === 'unread' ? params.emailLogId : null,
          email_address: params.issueType !== 'unread' ? params.emailAddress : null,
          last_event_at: params.lastEventAt || null,
          acknowledged_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-issues'] });
      toast.success('Issue acknowledged');
    },
    onError: (error: Error) => {
      toast.error('Failed to acknowledge issue: ' + error.message);
    },
  });
};

export const useAcknowledgeAllEmailIssues = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { 
      issueType: 'bounced' | 'unread';
      issues: Array<{ 
        id: string; 
        recipient_email: string; 
        issue_type: string;
        lastEventAt?: string;
      }>;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const insertData = params.issues.map(issue => ({
        issue_type: issue.issue_type,
        email_log_id: params.issueType === 'unread' ? issue.id : null,
        email_address: params.issueType !== 'unread' ? issue.recipient_email : null,
        last_event_at: issue.lastEventAt || null,
        acknowledged_by: user.id,
      }));

      const { error } = await supabase
        .from('email_issue_acknowledgments')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-issues'] });
      toast.success(`All ${variables.issues.length} issues acknowledged`);
    },
    onError: (error: Error) => {
      toast.error('Failed to acknowledge issues: ' + error.message);
    },
  });
};
