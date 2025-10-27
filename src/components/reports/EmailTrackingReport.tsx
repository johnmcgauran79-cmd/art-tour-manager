import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MailCheck, MailOpen, AlertCircle } from "lucide-react";

interface EmailTrackingReportProps {
  tourId: string;
}

export const EmailTrackingReport = ({ tourId }: EmailTrackingReportProps) => {
  const { data: emailLogs, isLoading } = useQuery({
    queryKey: ['email-tracking', tourId],
    refetchInterval: 10000, // Auto-refresh every 10 seconds to pick up new events
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select(`
          *,
          email_events (event_type, created_at),
          bookings (
            id,
            customers:lead_passenger_id (first_name, last_name)
          )
        `)
        .eq('tour_id', tourId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate summary metrics
  const metrics = emailLogs?.reduce((acc, log) => {
    acc.total++;
    
    const events = log.email_events || [];
    const hasDelivered = events.some((e: any) => e.event_type === 'delivered');
    const hasOpened = events.some((e: any) => e.event_type === 'opened');
    const hasClicked = events.some((e: any) => e.event_type === 'clicked');
    const hasBounced = events.some((e: any) => e.event_type === 'bounced');
    
    if (hasDelivered) acc.delivered++;
    if (hasOpened) acc.opened++;
    if (hasClicked) acc.clicked++;
    if (hasBounced) acc.bounced++;
    
    return acc;
  }, { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }) || 
  { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };

  const openRate = metrics.delivered > 0 
    ? ((metrics.opened / metrics.delivered) * 100).toFixed(1) 
    : '0.0';

  const getEmailStatus = (events: any[]) => {
    if (!events || events.length === 0) return { label: 'Sent', color: 'secondary', icon: Mail };
    
    const hasOpened = events.some((e: any) => e.event_type === 'opened');
    const hasDelivered = events.some((e: any) => e.event_type === 'delivered');
    const hasBounced = events.some((e: any) => e.event_type === 'bounced');
    
    if (hasBounced) return { label: 'Bounced', color: 'destructive', icon: AlertCircle };
    if (hasOpened) return { label: 'Opened', color: 'default', icon: MailOpen };
    if (hasDelivered) return { label: 'Delivered', color: 'secondary', icon: MailCheck };
    
    return { label: 'Sent', color: 'secondary', icon: Mail };
  };

  const getLastEventTime = (events: any[]) => {
    if (!events || events.length === 0) return null;
    
    const openEvents = events.filter((e: any) => e.event_type === 'opened');
    if (openEvents.length === 0) return null;
    
    const lastOpen = openEvents.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    
    return lastOpen.created_at;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!emailLogs || emailLogs.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Emails Sent Yet</h3>
        <p className="text-sm text-muted-foreground">
          Email tracking data will appear here once you start sending emails for this tour.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{metrics.total}</div>
          <div className="text-sm text-muted-foreground">Total Sent</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{metrics.delivered}</div>
          <div className="text-sm text-muted-foreground">Delivered</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{metrics.opened}</div>
          <div className="text-sm text-muted-foreground">Opened</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{openRate}%</div>
          <div className="text-sm text-muted-foreground">Open Rate</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-destructive">{metrics.bounced}</div>
          <div className="text-sm text-muted-foreground">Bounced</div>
        </div>
      </div>

      {/* Email List */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Last Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emailLogs.map((log: any) => {
              const status = getEmailStatus(log.email_events);
              const lastOpened = getLastEventTime(log.email_events);
              const StatusIcon = status.icon;
              
              return (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="font-medium">{log.recipient_name}</div>
                    <div className="text-sm text-muted-foreground">{log.recipient_email}</div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                  <TableCell>
                    <Badge variant={status.color as any} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.sent_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lastOpened ? format(new Date(lastOpened), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
