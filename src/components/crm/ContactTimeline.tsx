import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarCheck,
  FileText,
  Mail,
  MessageSquare,
  Milestone,
  PhoneCall,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useContactTimeline, type TimelineEntry } from "@/hooks/useCrm";

const ICONS: Record<TimelineEntry["kind"], any> = {
  activity: PhoneCall,
  form: FileText,
  lead: Milestone,
  task: MessageSquare,
  booking: CalendarCheck,
  email: Mail,
};

const LABELS: Record<TimelineEntry["kind"], string> = {
  activity: "Activity",
  form: "Form",
  lead: "Enquiry",
  task: "Task",
  booking: "Booking",
  email: "Campaign",
};

/** Everything that ever happened with this person, newest first. */
export function ContactTimeline({
  customerId,
  email,
}: {
  customerId: string;
  email?: string | null;
}) {
  const { data: entries = [], isLoading } = useContactTimeline(customerId, email);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">History</CardTitle>
        <CardDescription>
          Calls, notes, form submissions, enquiry stages, tasks, bookings and campaign emails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading history…</p>}
        {!isLoading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        )}
        <ol className="space-y-3">
          {entries.map((e) => {
            const Icon = ICONS[e.kind];
            const inner = (
              <div className="flex gap-3 rounded-md border p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{LABELS[e.kind]}</Badge>
                    <span className="text-sm font-medium capitalize">{e.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {format(new Date(e.at), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  {e.detail && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{e.detail}</p>
                  )}
                </div>
              </div>
            );
            return (
              <li key={e.id}>
                {e.link ? (
                  <Link to={e.link} className="block hover:opacity-80">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
