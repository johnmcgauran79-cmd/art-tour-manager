import { format } from "date-fns";
import { Link } from "react-router-dom";
import { CheckSquare, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useContactLeadHistory } from "@/hooks/useMarketing";

const CLOSED = ["completed", "cancelled", "archived", "not_required"];

/**
 * Leads, bookings and task history for a contact — including completed and
 * archived tasks, so staff always see the full paper trail.
 */
export function ContactLeadHistory({ customerId }: { customerId: string }) {
  const { data, isLoading } = useContactLeadHistory(customerId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
      </div>
    );
  }

  const submissions = data?.submissions || [];
  const tasks = data?.tasks || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Form submissions
          </CardTitle>
          <CardDescription>Register-interest and booking forms this contact submitted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {submissions.length === 0 && (
            <p className="text-sm text-muted-foreground">No form submissions yet.</p>
          )}
          {submissions.map((s: any) => (
            <div key={s.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={s.form_type === "booking" ? "default" : "secondary"}>
                  {s.form_type === "booking" ? "Booking request" : "Register interest"}
                </Badge>
                <span className="font-medium">{s.landing_page?.title || "Form"}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(s.created_at), "dd/MM/yyyy HH:mm")}
                </span>
                {s.consent_given && <Badge variant="outline">Marketing consent</Badge>}
                {s.task_id && (
                  <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <Link to={`/tasks/${s.task_id}`}>Open task</Link>
                  </Button>
                )}
              </div>
              {s.message && <p className="mt-2 text-muted-foreground">"{s.message}"</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4" /> Linked tasks
          </CardTitle>
          <CardDescription>
            Every task linked to this contact, open or completed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">No linked tasks yet.</p>}
          {tasks.map((t) => (
            <Link
              key={t.id}
              to={`/tasks/${t.id}`}
              className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/50"
            >
              <span className={CLOSED.includes(t.status) ? "text-muted-foreground line-through" : "font-medium"}>
                {t.title}
              </span>
              <Badge variant={CLOSED.includes(t.status) ? "outline" : "secondary"}>
                {t.status.replace(/_/g, " ")}
              </Badge>
              {t.category && <Badge variant="outline">{t.category}</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">
                {format(new Date(t.created_at), "dd/MM/yyyy")}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
