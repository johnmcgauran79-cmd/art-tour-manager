import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Clock, FileText, Inbox, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { useCrmDashboard, type Lead } from "@/hooks/useCrm";

/** The daily worklist: what arrived, what is due, what is being ignored. */
export function LeadInbox() {
  const { data, isLoading } = useCrmDashboard(30);

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading your worklist…</p>;
  }

  const groups: { title: string; description: string; icon: any; leads: Lead[]; tone?: string }[] = [
    { title: "New enquiries", description: "Arrived and not yet picked up.", icon: Sparkles, leads: data.newLeads },
    { title: "Due today", description: "Follow-ups scheduled for today.", icon: CalendarClock, leads: data.dueToday },
    { title: "Overdue", description: "Follow-up date has passed.", icon: AlertTriangle, leads: data.overdue, tone: "text-destructive" },
    { title: "Booking enquiries", description: "People asking to book.", icon: FileText, leads: data.bookingEnquiries },
    { title: "No next action", description: "Active enquiries with nothing planned.", icon: Inbox, leads: data.noNextAction, tone: "text-amber-600" },
    { title: "Recently active", description: "Latest movement across the pipeline.", icon: Clock, leads: data.recentlyActive },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.title}>
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center justify-between gap-2 text-base ${g.tone || ""}`}>
              <span className="flex items-center gap-2">
                <g.icon className="h-4 w-4" /> {g.title}
              </span>
              <Badge variant="secondary">{g.leads.length}</Badge>
            </CardTitle>
            <CardDescription>{g.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {g.leads.slice(0, 8).map((l) => (
              <Link
                key={l.id}
                to={`/leads/${l.id}`}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm hover:bg-muted/50"
              >
                <span className="truncate">
                  <span className="font-medium">
                    {l.customer?.first_name} {l.customer?.last_name}
                  </span>
                  {l.tour?.name && <span className="text-muted-foreground"> — {l.tour.name}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {l.next_action_date ? formatDateToDDMMYYYY(l.next_action_date) : l.stage.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
            {g.leads.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">Nothing here — nice work.</p>
            )}
            {g.leads.length > 8 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                and {g.leads.length - 8} more
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
