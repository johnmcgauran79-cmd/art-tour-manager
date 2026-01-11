import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailIssue {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  sent_at: string;
  tour_name: string | null;
  booking_id: string | null;
  issue_type: 'bounced' | 'complained' | 'unread';
  event_type?: string;
}

export const useEmailIssues = () => {
  return useQuery({
    queryKey: ['email-issues'],
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async () => {
      // Fetch all email logs with their events and tour info
      const { data: emailLogs, error } = await supabase
        .from('email_logs')
        .select(`
          id,
          recipient_email,
          recipient_name,
          subject,
          sent_at,
          booking_id,
          tour_id,
          tours:tour_id (name),
          email_events (event_type, created_at)
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      const bouncedErrors: EmailIssue[] = [];
      const unreadEmails: EmailIssue[] = [];

      emailLogs?.forEach((log: any) => {
        const events = log.email_events || [];
        const hasBounced = events.some((e: any) => e.event_type === 'bounced');
        const hasComplained = events.some((e: any) => e.event_type === 'complained');
        const hasOpened = events.some((e: any) => e.event_type === 'opened');
        const hasDelivered = events.some((e: any) => e.event_type === 'delivered');

        const baseIssue = {
          id: log.id,
          recipient_email: log.recipient_email,
          recipient_name: log.recipient_name,
          subject: log.subject,
          sent_at: log.sent_at,
          tour_name: log.tours?.name || null,
          booking_id: log.booking_id,
        };

        if (hasBounced) {
          bouncedErrors.push({
            ...baseIssue,
            issue_type: 'bounced',
            event_type: 'bounced',
          });
        } else if (hasComplained) {
          bouncedErrors.push({
            ...baseIssue,
            issue_type: 'complained',
            event_type: 'complained',
          });
        } else if (hasDelivered && !hasOpened) {
          // Only count as unread if delivered but not opened
          unreadEmails.push({
            ...baseIssue,
            issue_type: 'unread',
          });
        }
      });

      return {
        bouncedErrors,
        unreadEmails,
        bouncedCount: bouncedErrors.length,
        unreadCount: unreadEmails.length,
      };
    },
  });
};
