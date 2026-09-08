import { AlertTriangle, CheckCircle2, Clock, Snowflake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { type LeadFact } from "@/hooks/useCrmSales";

/** Loud, unmissable summary of whether this enquiry is actually being worked. */
export function LeadAttentionCard({ fact }: { fact?: LeadFact | null }) {
  if (!fact) return null;

  const problems: { icon: any; text: string }[] = [];
  if (fact.awaiting_first_response)
    problems.push({ icon: Clock, text: "Nobody has responded to this enquiry yet." });
  if (fact.no_next_action)
    problems.push({ icon: AlertTriangle, text: "There is no next action planned." });
  if (fact.next_action_overdue)
    problems.push({
      icon: AlertTriangle,
      text: `The follow-up was due ${formatDateToDDMMYYYY(fact.next_action_date!)}.`,
    });
  if (fact.is_stale)
    problems.push({
      icon: Snowflake,
      text: `No real contact for ${fact.business_days_in_stage} working days in ${fact.stage_label || fact.stage}.`,
    });
  if (fact.client_replied)
    problems.push({ icon: Clock, text: "The client has replied and is waiting on us." });

  return (
    <Card className={problems.length ? "border-destructive/50 bg-destructive/5" : "bg-muted/30"}>
      <CardContent className="space-y-2 p-4 text-sm">
        {problems.length === 0 ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {fact.stage_exempt
              ? "Nothing needed right now — this stage is not chased for follow-ups."
              : "On track: someone owns it and the next step is booked in."}
          </p>
        ) : (
          problems.map((p, i) => (
            <p key={i} className="flex items-center gap-2 font-medium text-destructive">
              <p.icon className="h-4 w-4" /> {p.text}
            </p>
          ))
        )}

        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <Badge variant="outline">Age {fact.lead_age_days} days</Badge>
          <Badge variant="outline">{fact.business_days_in_stage} working days in stage</Badge>
          <Badge variant="outline">
            {fact.first_response_hours == null
              ? "No response yet"
              : `First response ${fact.first_response_hours.toFixed(1)} hrs`}
          </Badge>
          <Badge variant="outline">{fact.meaningful_count} sales contacts logged</Badge>
          <Badge variant="outline">
            {fact.open_future_tasks ? `${fact.open_future_tasks} task(s) planned` : "No planned task"}
          </Badge>
          <Badge variant="outline">
            {fact.prospective_passengers
              ? `${fact.prospective_passengers} travelling`
              : "Number travelling unknown"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
