import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Flame,
  FileText,
  Inbox,
  MailOpen,
  PhoneOff,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useAuth } from "@/hooks/useAuth";
import { useActionBoard, type LeadFact } from "@/hooks/useCrmSales";

const ALL = "all";

/** The daily worklist: what arrived, what is due, and what is being neglected. */
export function LeadInbox() {
  const { data, isLoading } = useActionBoard();
  const { data: users = [] } = useAssignableUsers();
  const { user } = useAuth();
  const [owner, setOwner] = useState(ALL);

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading your worklist…</p>;
  }

  const mine = (list: LeadFact[] = []) =>
    owner === ALL
      ? list
      : owner === "unassigned"
        ? list.filter((l) => !l.owner_id)
        : list.filter((l) => l.owner_id === owner);

  const groups: {
    title: string;
    description: string;
    icon: any;
    leads: LeadFact[];
    tone?: string;
  }[] = [
    { title: "New enquiries", description: "Arrived and still sitting in New.", icon: Sparkles, leads: mine(data.new_leads) },
    { title: "Never contacted", description: "No genuine outbound contact recorded yet.", icon: PhoneOff, leads: mine(data.uncontacted), tone: "text-amber-600" },
    { title: "Client has replied", description: "They came back to us — needs a human answer.", icon: MailOpen, leads: mine(data.client_replies) },
    { title: "Due today", description: "Follow-ups scheduled for today.", icon: CalendarClock, leads: mine(data.due_today) },
    { title: "Overdue", description: "The follow-up date has passed.", icon: AlertTriangle, leads: mine(data.overdue), tone: "text-destructive" },
    { title: "No next action", description: "Active enquiries with nothing planned.", icon: Inbox, leads: mine(data.no_next_action), tone: "text-destructive" },
    { title: "Going cold", description: "No real sales contact within the time allowed for the stage.", icon: Snowflake, leads: mine(data.stale), tone: "text-amber-600" },
    { title: "High priority", description: "Marked high or urgent and still open.", icon: Flame, leads: mine(data.high_priority) },
    { title: "Booking enquiries", description: "People asking to book right now.", icon: FileText, leads: mine(data.booking_enquiries) },
    { title: "Nurture due for review", description: "Long-term prospects whose review date has arrived.", icon: Clock, leads: mine(data.nurture_due) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Everyone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Everyone's enquiries</SelectItem>
            {user?.id && <SelectItem value={user.id}>Only mine</SelectItem>}
            <SelectItem value="unassigned">Nobody looking after them</SelectItem>
            {users
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Counts exclude enquiries in long-term nurture, booked and lost, except where a group says otherwise.
        </p>
      </div>

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
                      {l.first_name} {l.last_name}
                    </span>
                    {l.tour_name && <span className="text-muted-foreground"> — {l.tour_name}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {l.next_action_date
                      ? formatDateToDDMMYYYY(l.next_action_date)
                      : `${l.business_days_in_stage}d in ${l.stage_label || l.stage}`}
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

      <Button asChild variant="outline" size="sm">
        <Link to="/leads?ltab=pipeline">Open the full pipeline</Link>
      </Button>
    </div>
  );
}
