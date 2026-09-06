import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionDetailDialog } from "./SubmissionDetailDialog";
import {
  useCustomerSubmissions,
  useLeadSubmissions,
  type FormSubmission,
} from "@/hooks/useFormSubmissions";

/**
 * Forms history for a contact or an enquiry. Opening a row shows the original
 * answers exactly as submitted.
 */
export function SubmissionsList({
  customerId,
  leadId,
  title = "Forms submitted",
}: {
  customerId?: string | null;
  leadId?: string | null;
  title?: string;
}) {
  const byCustomer = useCustomerSubmissions(leadId ? null : customerId);
  const byLead = useLeadSubmissions(leadId);
  const rows = (leadId ? byLead.data : byCustomer.data) || [];
  const [selected, setSelected] = useState<FormSubmission | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">No website forms submitted.</p>
        )}
        {rows.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="flex w-full flex-wrap items-center gap-2 rounded-md border p-2.5 text-left text-sm hover:bg-muted/50"
          >
            <span className="text-muted-foreground">
              {format(new Date(s.created_at), "dd/MM/yyyy HH:mm")}
            </span>
            <Badge variant={s.form_type === "booking" ? "default" : "secondary"}>
              {s.form_type === "booking" ? "Booking form" : "Register interest"}
            </Badge>
            <span className="font-medium">{s.landing_page?.title || "Form"}</span>
            {!!s.tour_ids?.length && (
              <span className="text-muted-foreground">
                {s.tour_ids.length} tour{s.tour_ids.length === 1 ? "" : "s"} selected
              </span>
            )}
            {(s.needs_review || s.processing_status !== "processed") && (
              <Badge variant="outline" className="gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" /> Needs attention
              </Badge>
            )}
            <Button variant="link" size="sm" className="ml-auto h-auto p-0" asChild>
              <span>View answers</span>
            </Button>
          </button>
        ))}
      </CardContent>

      <SubmissionDetailDialog
        submission={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </Card>
  );
}
