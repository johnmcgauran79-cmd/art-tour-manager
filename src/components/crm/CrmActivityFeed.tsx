import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useCrmActivities } from "@/hooks/useCrm";
import { labelFor, ACTIVITY_TYPES, ACTIVITY_OUTCOMES } from "@/lib/crm/constants";

interface Props {
  customerId?: string | null;
  leadId?: string | null;
}

/** Chronological log of calls, notes, meetings and complaints. */
export function CrmActivityFeed({ customerId, leadId }: Props) {
  const { data: activities = [], isLoading } = useCrmActivities({ customerId, leadId });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  if (activities.length === 0)
    return <p className="text-sm text-muted-foreground">Nothing logged yet.</p>;

  return (
    <ol className="space-y-3">
      {activities.map((a) => (
        <li key={a.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{labelFor(ACTIVITY_TYPES, a.activity_type)}</Badge>
            {a.direction && <Badge variant="outline" className="capitalize">{a.direction}</Badge>}
            {a.outcome && (
              <Badge variant="outline">{labelFor(ACTIVITY_OUTCOMES, a.outcome)}</Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {format(new Date(a.occurred_at), "dd/MM/yyyy HH:mm")}
            </span>
          </div>
          {a.subject && <p className="mt-2 text-sm font-medium">{a.subject}</p>}
          {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
        </li>
      ))}
    </ol>
  );
}
