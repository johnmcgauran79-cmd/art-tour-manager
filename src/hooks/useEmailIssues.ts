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
  lastEventAt?: string;
}

interface Acknowledgment {
  email_log_id: string | null;
  email_address: string | null;
  issue_type: string;
  last_event_at: string | null;
}

export const useEmailIssues = () => {
  return useQuery({
    queryKey: ['email-issues'],
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async () => {
      // Fetch email logs with events and tour info
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

      // Fetch acknowledgments
      const { data: acknowledgments, error: ackError } = await supabase
        .from('email_issue_acknowledgments')
        .select('email_log_id, email_address, issue_type, last_event_at');

      if (ackError) throw ackError;

      // Build lookup maps for acknowledgments
      const unreadAckSet = new Set(
        (acknowledgments as Acknowledgment[] || [])
          .filter(a => a.issue_type === 'unread' && a.email_log_id)
          .map(a => a.email_log_id)
      );

      const bouncedAckMap = new Map<string, string>();
      (acknowledgments as Acknowledgment[] || [])
        .filter(a => (a.issue_type === 'bounced' || a.issue_type === 'complained') && a.email_address)
        .forEach(a => {
          const existing = bouncedAckMap.get(a.email_address!);
          if (!existing || (a.last_event_at && a.last_event_at > existing)) {
            bouncedAckMap.set(a.email_address!, a.last_event_at || '');
          }
        });

      const bouncedErrors: EmailIssue[] = [];
      const unreadEmails: EmailIssue[] = [];

      emailLogs?.forEach((log: any) => {
        const events = log.email_events || [];
        const bouncedEvent = events.find((e: any) => e.event_type === 'bounced');
        const complainedEvent = events.find((e: any) => e.event_type === 'complained');
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

        if (bouncedEvent) {
          const lastAckTime = bouncedAckMap.get(log.recipient_email);
          // Show if not acknowledged OR if a new bounce occurred after acknowledgment
          if (!lastAckTime || bouncedEvent.created_at > lastAckTime) {
            bouncedErrors.push({
              ...baseIssue,
              issue_type: 'bounced',
              event_type: 'bounced',
              lastEventAt: bouncedEvent.created_at,
            });
          }
        } else if (complainedEvent) {
          const lastAckTime = bouncedAckMap.get(log.recipient_email);
          if (!lastAckTime || complainedEvent.created_at > lastAckTime) {
            bouncedErrors.push({
              ...baseIssue,
              issue_type: 'complained',
              event_type: 'complained',
              lastEventAt: complainedEvent.created_at,
            });
          }
        } else if (hasDelivered && !hasOpened) {
          // Only show unread if not acknowledged
          if (!unreadAckSet.has(log.id)) {
            unreadEmails.push({
              ...baseIssue,
              issue_type: 'unread',
            });
          }
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
