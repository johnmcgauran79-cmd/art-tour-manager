import { format } from "date-fns";
import { Mail, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import {
  emailStatusBadgeVariant,
  type EmailStatusLabel,
} from "@/lib/emailStatus";
import type { CommunicationRow } from "@/hooks/useCommunications";

interface Props {
  rows: CommunicationRow[] | undefined;
  isLoading: boolean;
  /** When true, show the booking/tour a message belongs to (contact view). */
  showContext?: boolean;
}

const statusLabel = (label: EmailStatusLabel) => label;

export const CommunicationsTimeline = ({
  rows,
  isLoading,
  showContext = false,
}: Props) => {
  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        Loading communications…
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <Mail className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No emails have been sent yet.</p>
      </div>
    );
  }

  const issues = rows.filter((r) => r.status.hasIssue);

  return (
    <div className="space-y-4">
      {issues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {issues.length} email{issues.length > 1 ? "s" : ""} had a delivery
            issue (bounced, marked as spam, or failed). Review the highlighted
            rows below.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border divide-y">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`p-4 flex flex-col gap-1.5 ${
              row.status.hasIssue ? "bg-destructive/5" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{row.subject}</p>
                <p className="text-xs text-muted-foreground truncate">
                  To {row.recipientName ? `${row.recipientName} · ` : ""}
                  {row.recipientEmail}
                </p>
              </div>
              <Badge
                variant={emailStatusBadgeVariant(row.status.label)}
                className="flex-shrink-0"
              >
                {statusLabel(row.status.label)}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{format(new Date(row.sentAt), "dd/MM/yyyy 'at' HH:mm")}</span>
              {row.templateName && <span>· {row.templateName}</span>}
              {row.status.lastOpenedAt && (
                <span>
                  · Last opened{" "}
                  {format(new Date(row.status.lastOpenedAt), "dd/MM/yyyy HH:mm")}
                </span>
              )}
              {showContext && row.tourName && (
                <span>
                  ·{" "}
                  {row.bookingId ? (
                    <Link
                      to={`/bookings/${row.bookingId}`}
                      className="underline hover:text-foreground"
                    >
                      {row.tourName}
                    </Link>
                  ) : (
                    row.tourName
                  )}
                </span>
              )}
            </div>

            {row.errorMessage && (
              <p className="text-xs text-destructive mt-1">{row.errorMessage}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};